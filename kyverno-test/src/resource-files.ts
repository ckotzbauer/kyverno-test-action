
import * as core from "@actions/core"
import * as glob from "@actions/glob"
import * as io from "@actions/io"
import * as exec from "@actions/exec"
import { readFile, writeFile } from "fs"
import { promisify } from "util"
import { loadAll } from "js-yaml";
import { Resource } from "./types"

export const fetchResources = async function (): Promise<Resource[]> {
    const resourceFiles = core.getInput("resource-files", { required: false }).split("\n").filter(s => s);
    await io.mkdirP("/tmp/kyverno-test");
    const resourceContents: string[] = [];
    let resources: Resource[] = [];

    for await (const input of resourceFiles) {
        const globber = await glob.create(input, { followSymbolicLinks: false });
        const files = await globber.glob();
        for await (const file of files) {
            const content = (await promisify(readFile)(file, "utf-8")).toString();
            resourceContents.push(content);
            resources = [...resources, ...parseResource(content)];
        }
    }

    const chartDir = core.getInput("chart-dir", { required: false });
    const valueFiles = core.getInput("value-files", { required: false }).split("\n").filter(s => s);

    if (chartDir) {
        let stdOut = "";
        let stdErr = "";
        const options = {} as any;
        options.listeners = {
            stdout: (data: Buffer) => stdOut += data.toString(),
            stderr: (data: Buffer) => stdErr += data.toString()
        };

        const values = valueFiles.map(f => ["-f", f]).flat();
        const exitCode = await exec.exec('helm', ['template', chartDir, ...values], options);

        if (exitCode === 0) {
            resourceContents.push(stdOut);
            resources = [...resources, ...parseResource(stdOut)];
        } else {
            core.error(`Helm exited with code ${exitCode} and output: ${stdErr}`);
        }
    }

    await promisify(writeFile)("/tmp/kyverno-test/resources.yaml", resourceContents.join("---\n"));
    return resources;
}

export const parseResource = function (content: string): Resource[] {
    return loadAll(content) as Resource[];
}

