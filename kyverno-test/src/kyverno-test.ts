import * as core from "@actions/core"
import { ClusterPolicy, Resource, Test } from "./types";
import { dump } from "js-yaml";
import { promisify } from "util";
import { writeFile } from "fs";
import * as exec from "@actions/exec"

const generateTestFile = async function (policies: ClusterPolicy[], resources: Resource[]): Promise<void> {
    const test: Test = {
        name: "kyverno-test",
        resources: ["/tmp/kyverno-test/resources.yaml"],
        policies: ["/tmp/kyverno-test/rules.yaml"],
        results: []
    };

    for (const policy of policies) {
        for (const rule of policy.spec.rules) {
            for (const resource of resources) {
                const includes = rule?.match?.resources?.kinds ?.includes(resource.kind) ?? false;
                const excludes = rule?.exclude?.resources?.kinds?.includes(resource.kind) ?? false;

                if (includes && !excludes) {
                    test.results.push({
                        policy: policy.metadata.name,
                        rule: rule.name,
                        resource: resource.metadata.name,
                        status: "pass"
                    });
                }
            }
        }
    }

    const testContent = dump(test, { indent: 2 });
    await promisify(writeFile)("/tmp/kyverno-test/test.yaml", testContent);
};

export const executeTest = async function (policies: ClusterPolicy[], resources: Resource[]): Promise<void> {
    await generateTestFile(policies, resources);

    let stdOut = "";
    let stdErr = "";
    const options = {} as any;
    options.listeners = {
        stdout: (data: Buffer) => stdOut += data.toString(),
        stderr: (data: Buffer) => stdErr += data.toString()
    };

    const exitCode = await exec.exec('kyverno', ['test', "/tmp/kyverno-test"], options);

    core.info("stdOut");
    core.info(stdOut);
    core.error("stdErr");
    core.error(stdErr);

    if (exitCode === 0) {
        core.info("Test successful!");
    } else {
        core.error(`Kyverno exited with code ${exitCode}.`);
    }
}
