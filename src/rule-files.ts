import * as core from "@actions/core"
import * as glob from "@actions/glob"
import * as io from "@actions/io"
import isUrl from "is-url"
import isGitUrl from "is-git-url"
import axios from "axios"
import { readFile, writeFile } from "fs"
import { promisify } from "util"
import { loadAll } from "js-yaml";
import { ClusterPolicy, Rule } from "./types"
import { dump } from "js-yaml";

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
                const parsedPolicies = parsePolicyFile(response.data as string);
                policies = [...policies, ...parsedPolicies];
                ruleContents.push(...parsedPolicies.map(p => dump(p, { indent: 2 })));
            }
        }
    }

    const globber = await glob.create(core.getInput("rule-files", { required: true }), { followSymbolicLinks: false });
    const files = await globber.glob();
    for await (const file of files) {
        const content = (await promisify(readFile)(file, "utf-8")).toString();
        const parsedPolicies = parsePolicyFile(content);
        policies = [...policies, ...parsedPolicies];
        ruleContents.push(...parsedPolicies.map(p => dump(p, { indent: 2 })));
    }

    const joined = ruleContents.join("\n---\n");
    core.debug("Discovered rules to check:");
    core.debug(joined);
    await promisify(writeFile)("/tmp/kyverno-test/rules.yaml", joined);

    if (policies.length === 0) {
        core.setFailed("No policies found!");
    }

    return policies;
}

export const parsePolicyFile = function (content: string): ClusterPolicy[] {
    const policies = loadAll(content) as ClusterPolicy[];
    for (const policy of policies) {
        const additionalRules: Rule[] = [];

        for (const rule of policy.spec.rules) {
            const relatesToPods = rule?.match?.resources?.kinds?.includes("Pod") 
                || rule?.exclude?.resources?.kinds?.includes("Pod");
            const hasPatternOrAntiPattern = rule?.validate?.pattern
                || rule?.validate?.anyPattern;

            if (relatesToPods && hasPatternOrAntiPattern) {
                const autoGenRules: Rule[] = [
                    {
                        name: `autogen-${rule.name}`,
                        match: rule.match 
                            ? { resources: { kinds: ["DaemonSet", "Deployment", "Job", "StatefulSet"] } }
                            : null,
                        exclude: rule.exclude
                            ? { resources: { kinds: ["DaemonSet", "Deployment", "Job", "StatefulSet"] } }
                            : null,
                        validate: {
                            message: rule.validate.message,
                            pattern: rule.validate.pattern 
                                ? { spec: { template: rule.validate.pattern } }
                                : null,
                            anyPattern: rule.validate.anyPattern
                                ? { spec: { template: rule.validate.pattern } }
                                : null
                        }
                    },
                    {
                        name: `autogen-cronjob-${rule.name}`,
                        match: rule.match
                            ? { resources: { kinds: ["CronJob"] } }
                            : null,
                        exclude: rule.exclude
                            ? { resources: { kinds: ["CronJob"] } }
                            : null,
                        validate: {
                            message: rule.validate.message,
                            pattern: rule.validate.pattern
                                ? { spec: { jobTemplate: { spec: { template: rule.validate.pattern } } } }
                                : null,
                            anyPattern: rule.validate.anyPattern
                                ? { spec: { jobTemplate: { spec: { template: rule.validate.pattern } } } }
                                : null
                        }
                    }
                ];

                additionalRules.push(...autoGenRules);
            }
        }

        policy.spec.rules = [...policy.spec.rules, ...additionalRules];
    }
    return policies;
}
