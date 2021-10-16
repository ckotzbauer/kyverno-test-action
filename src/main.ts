import * as core from "@actions/core"
import { setupKyvernoCli } from "./kyverno-cli-setup";
import { executeTest } from "./kyverno-test";
import { fetchResources } from "./resource-files";
import { fetchPolicies } from "./rule-files";

async function run(): Promise<void> {
  try {
    await setupKyvernoCli();

    const policies = await fetchPolicies();
    const resources = await fetchResources();
    await executeTest(policies, resources);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
