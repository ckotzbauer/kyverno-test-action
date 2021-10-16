import * as core from "@actions/core"
import * as glob from "@actions/glob"
import * as io from "@actions/io"
import isUrl from "is-url"
import isGitUrl from "is-git-url"
import axios from "axios"
import { readFile, writeFile } from "fs"
import { promisify } from "util"
import { loadAll } from "js-yaml";
import { ClusterPolicy } from "./types"

export const fetchPolicies = async function(): Promise<ClusterPolicy[]> {
    const inputs = core.getInput("rule-files", { required: true }).split("\n").filter(s => s);
    await io.mkdirP("/tmp/kyverno-test");
    const ruleContents: string[] = [];
    let policies: ClusterPolicy[] = [];

    for await (const input of inputs) {
        if (isGitUrl(input)) {

        } else if (isUrl(input)) {
            const response = await axios.get(input);
            if (response.status >= 200 && response.status < 300 && (response.data as string)?.length > 0) {
                const content = response.data as string;
                ruleContents.push(content);
                policies = [...policies, ...parsePolicyFile(content)];
            }
        }
    }

    const globber = await glob.create(core.getInput("rule-files", { required: true }), { followSymbolicLinks: false });
    core.info(globber.getSearchPaths().join("\n"));
    const files = await globber.glob();
    for await (const file of files) {
        const content = (await promisify(readFile)(file, "utf-8")).toString();
        ruleContents.push(content);
        policies = [...policies, ...parsePolicyFile(content)];
    }

    const joined = ruleContents.join("\n---\n");
    core.info(joined);
    await promisify(writeFile)("/tmp/kyverno-test/rules.yaml", joined);

    if (policies.length === 0) {
        core.setFailed("No policies found!");
    }

    return policies;
}

export const parsePolicyFile = function (content: string): ClusterPolicy[] {
    return loadAll(content) as ClusterPolicy[];
}
