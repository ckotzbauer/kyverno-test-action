import * as core from "@actions/core";
import * as path from "path";
import * as semver from "semver";

import * as toolCache from "@actions/tool-cache";
import { graphql } from "@octokit/graphql";
import { chmodSync, osType, readdirSync, readFileSync, statSync } from "./util";

const kyvernoToolName = "kyverno";
const stableKyvernoVersion = "v1.4.3";
const latestKyvernoVersion = "1.*";
const kyvernoAllReleasesUrl = "https://api.github.com/repos/kyverno/kyverno/releases";


export function getExecutableExtension(): string {
  if (osType().match(/^Win/)) {
    return ".exe";
  }
  return "";
}

export function getKyvernoDownloadURL(version: string): string {
  switch (osType()) {
    case "Linux":
      // eslint-disable-next-line max-len
      return `https://github.com/kyverno/kyverno/releases/download/${version}/kyverno-cli_${version}_linux_x86_64.tar.gz`;

    case "Darwin":
      // eslint-disable-next-line max-len
      return `https://github.com/kyverno/kyverno/releases/download/${version}/kyverno-cli_${version}_darwin_x86_64.tar.gz`;

    case "Windows_NT":
    default:
      return `https://github.com/kyverno/kyverno/releases/download/${version}/kyverno-cli_${version}_windows_x86_64.zip`;
  }
}

export async function getStableKyvernoVersion(): Promise<string> {
  try {
    const downloadPath = await toolCache.downloadTool(kyvernoAllReleasesUrl);
    const responseArray = JSON.parse(readFileSync(downloadPath, "utf8").toString().trim());
    let latestKyvernoVersion = semver.clean(stableKyvernoVersion);
    for (const response of responseArray) {
      if (response && response.tag_name) {
        const currentKyvernoVerison = semver.clean(response.tag_name.toString());
        if (currentKyvernoVerison) {
          if (!currentKyvernoVerison.toString().includes("rc") && semver.gt(currentKyvernoVerison, latestKyvernoVersion)) {
            //If current kyverno version is not a pre release and is greater than latest kyverno version
            latestKyvernoVersion = currentKyvernoVerison;
          }
        }
      }
    }
    latestKyvernoVersion = `v${latestKyvernoVersion}`;
    return latestKyvernoVersion;
  } catch (error) {
    core.warning(
      // eslint-disable-next-line max-len
      `Cannot get the latest Kyverno info from ${kyvernoAllReleasesUrl}. Error ${error}. Using default Kyverno version ${stableKyvernoVersion}.`
    );
  }

  return stableKyvernoVersion;
}

export const walkSync = (dir: string, filelist: string[], fileToFind: string): string[] => {
  const files = readdirSync(dir);
  filelist = filelist || [];
  for (const file of files) {
    if (statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist, fileToFind);
    } else {
      core.debug(file);
      if (file === fileToFind) {
        filelist.push(path.join(dir, file));
      }
    }
  }
  return filelist;
};

export async function downloadKyverno(version: string): Promise<string> {
  if (!version) {
    version = await getStableKyvernoVersion();
  }
  let cachedToolpath = toolCache.find(kyvernoToolName, version);
  if (!cachedToolpath) {
    const downloadUrl = getKyvernoDownloadURL(version);
    let kyvernoDownloadPath;
    try {
      core.info(`Download kyverno from url: ${downloadUrl}`);
      kyvernoDownloadPath = await toolCache.downloadTool(downloadUrl);
    } catch (exception) {
      throw new Error(`Failed to download Kyverno from location ${downloadUrl}`);
    }

    chmodSync(kyvernoDownloadPath, "777");
    core.info(`Extract kyverno archive: ${kyvernoDownloadPath}`);
    let extractedKyvernoPath: string;
    if (osType() !== "Windows_NT") {
      extractedKyvernoPath = await toolCache.extractTar(kyvernoDownloadPath);
    } else {
      extractedKyvernoPath = await toolCache.extractZip(kyvernoDownloadPath);
    }

    cachedToolpath = await toolCache.cacheDir(extractedKyvernoPath, kyvernoToolName, version);
  }

  const kyvernopath = findKyverno(cachedToolpath);
  if (!kyvernopath) {
    throw new Error(`Kyverno executable not found in path ${cachedToolpath}`);
  }

  chmodSync(kyvernopath, "777");
  return kyvernopath;
}

async function getLatestKyvernoVersion(): Promise<string> {
  const token = core.getInput("token", { required: true });
  try {
    const { repository } = await graphql(
      `
        {
          repository(name: "kyverno", owner: "kyverno") {
            releases(last: 100) {
              nodes {
                tagName
              }
            }
          }
        }
      `,
      {
        headers: {
          authorization: `token ${token}`,
        },
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const releases: any[] = repository.releases.nodes.reverse();
    const latestValidRelease = releases.find((release) => isValidVersion(release.tagName));
    if (latestValidRelease) return latestValidRelease.tagName;
  } catch (err) {
    core.warning(
      `Error while fetching the latest Kyverno release. Error: ${(
        err as Error
      ).toString()}. Using default Kyverno version ${stableKyvernoVersion}.`
    );
    return stableKyvernoVersion;
  }
  core.warning(`Could not find stable release for Kyverno. Using default Kyverno version ${stableKyvernoVersion}.`);
  return stableKyvernoVersion;
}

// isValidVersion checks if verison matches the specified type and is a stable release
function isValidVersion(version: string): boolean {
  return !version.includes("rc");
}

export function findKyverno(rootFolder: string): string {
  chmodSync(rootFolder, "777");
  const filelist: string[] = [];
  walkSync(rootFolder, filelist, kyvernoToolName + getExecutableExtension());
  if (!filelist || filelist.length === 0) {
    throw new Error(`Kyverno executable not found in path ${rootFolder}`);
  } else {
    return filelist[0];
  }
}

export async function setupKyvernoCli(): Promise<void> {
  let version = core.getInput("kyverno-version", { required: true });

  if (version.toLocaleLowerCase() === "latest" || version === latestKyvernoVersion) {
    version = await getLatestKyvernoVersion();
  } else if (!version.toLocaleLowerCase().startsWith("v")) {
    version = `v${version}`;
  }

  core.debug(`Downloading ${version}`);
  const cachedPath = await downloadKyverno(version);

  try {
    if (!process.env["PATH"]?.startsWith(path.dirname(cachedPath))) {
      core.addPath(path.dirname(cachedPath));
    }
  } catch {
    //do nothing, set as output variable
  }

  core.debug(`Kyverno tool version: '${version}' has been cached at ${cachedPath}`);
}
