import * as core from "@actions/core"
import { ClusterPolicy, Resource, Test } from "./types";
import { dump } from "js-yaml";
import { promisify } from "util";
import { writeFile } from "fs";
import * as exec from "@actions/exec"

const generateTestFile = async function (policies: ClusterPolicy[], resources: Resource[]): Promise<void> {
    const test: Test = {
        name: "kyverno-test",
        resources: ["resources.yaml"],
        policies: ["rules.yaml"],
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
    const output = await exec.getExecOutput('kyverno', ['test', "/tmp/kyverno-test"]);

    core.info("stdOut");
    core.info(output.stdout);
    core.error("stdErr");
    core.error(output.stderr);

    if (output.exitCode === 0) {
        core.info("Test successful!");
    } else {
        core.error(`Kyverno exited with code ${output.exitCode}.`);
    }
}
