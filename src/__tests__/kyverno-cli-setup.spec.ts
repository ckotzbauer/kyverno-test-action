/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import * as cliSetup from '../kyverno-cli-setup'
import * as util from '../util'
import * as toolCache from '@actions/tool-cache';
import * as path from 'path';
import * as fs from 'fs';
import * as core from '@actions/core';

describe('kyverno-cli-setup', () => {
    test('getExecutableExtension() - return .exe when os is Windows', () => {
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');

        expect(cliSetup.getExecutableExtension()).toBe('.exe');
        expect(util.osType).toBeCalled();
    });

    test('getExecutableExtension() - return empty string for non-windows OS', () => {
        jest.spyOn(util, 'osType').mockReturnValue('Darwin');

        expect(cliSetup.getExecutableExtension()).toBe('');
        expect(util.osType).toBeCalled();
    });

    test('getKyvernoDownloadURL() - return the URL to download kyverno for Linux', () => {
        jest.spyOn(util, 'osType').mockReturnValue('Linux');
        const kyvernoLinuxUrl = 'https://github.com/kyverno/kyverno/releases/download/v1.4.0/kyverno-cli_v1.4.0_linux_x86_64.tar.gz'

        expect(cliSetup.getKyvernoDownloadURL('v1.4.0')).toBe(kyvernoLinuxUrl);
        expect(util.osType).toBeCalled();
    });

    test('getKyvernoDownloadURL() - return the URL to download kyverno for Darwin', () => {
        jest.spyOn(util, 'osType').mockReturnValue('Darwin');
        const kyvernoDarwinUrl = 'https://github.com/kyverno/kyverno/releases/download/v1.4.0/kyverno-cli_v1.4.0_darwin_x86_64.tar.gz'

        expect(cliSetup.getKyvernoDownloadURL('v1.4.0')).toBe(kyvernoDarwinUrl);
        expect(util.osType).toBeCalled();
    });

    test('getKyvernoDownloadURL() - return the URL to download kyverno for Windows', () => {
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');

        const kyvernoWindowsUrl = 'https://github.com/kyverno/kyverno/releases/download/v1.4.0/kyverno-cli_v1.4.0_windows_x86_64.zip'
        expect(cliSetup.getKyvernoDownloadURL('v1.4.0')).toBe(kyvernoWindowsUrl);
        expect(util.osType).toBeCalled();
    });

    test('getStableKyvernoVersion() - download stable version file, read version and return it', async () => {
        jest.spyOn(toolCache, 'downloadTool').mockResolvedValue('pathToTool');
        const response = JSON.stringify(
            [
                {
                    'tag_name': 'v4.0.0'
                }, {
                    'tag_name': 'v3.0.0'
                }, {
                    'tag_name': 'v2.0.0'
                }
            ]
        );
        jest.spyOn(util, 'readFileSync').mockReturnValue(response);

        expect(await cliSetup.getStableKyvernoVersion()).toBe('v4.0.0');
        expect(toolCache.downloadTool).toBeCalled();
        expect(util.readFileSync).toBeCalledWith('pathToTool', 'utf8');
    });

    test('getStableKyvernoVersion() - return default version if error occurs while getting latest version', async () => {
        jest.spyOn(toolCache, 'downloadTool').mockRejectedValue('Unable to download');
        jest.spyOn(core, 'warning').mockImplementation();

        expect(await cliSetup.getStableKyvernoVersion()).toBe('v1.4.3');
        expect(toolCache.downloadTool).toBeCalled();
        expect(core.warning).toBeCalledWith("Cannot get the latest Kyverno info from https://api.github.com/repos/kyverno/kyverno/releases. Error Unable to download. Using default Kyverno version v1.4.3.");
    });

    test('walkSync() - return path to the all files matching fileToFind in dir', () => {
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => {
            if (file == 'mainFolder') return ['file1', 'file2', 'folder1', 'folder2'];
            if (file == path.join('mainFolder', 'folder1')) return ['file11', 'file12'];
            if (file == path.join('mainFolder', 'folder2')) return ['file21', 'file22'];
        });
        jest.spyOn(core, 'debug').mockImplementation();
        jest.spyOn(util, 'statSync').mockImplementation((file) => {
            const isDirectory = (file as string).toLowerCase().indexOf('file') == -1 ? true : false
            return { isDirectory: () => isDirectory } as fs.Stats;
        });

        expect(cliSetup.walkSync('mainFolder', null, 'file21')).toEqual([path.join('mainFolder', 'folder2', 'file21')]);
        expect(util.readdirSync).toBeCalledTimes(3);
        expect(util.statSync).toBeCalledTimes(8);
    });

    test('walkSync() - return empty array if no file with name fileToFind exists', () => {
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => {
            if (file == 'mainFolder') return ['file1', 'file2', 'folder1', 'folder2'];
            if (file == path.join('mainFolder', 'folder1')) return ['file11', 'file12'];
            if (file == path.join('mainFolder', 'folder2')) return ['file21', 'file22'];
        });
        jest.spyOn(core, 'debug').mockImplementation();
        jest.spyOn(util, 'statSync').mockImplementation((file) => {
            const isDirectory = (file as string).toLowerCase().indexOf('file') == -1 ? true : false
            return { isDirectory: () => isDirectory } as fs.Stats;
        });

        expect(cliSetup.walkSync('mainFolder', null, 'kyverno.exe')).toEqual([]);
        expect(util.readdirSync).toBeCalledTimes(3);
        expect(util.statSync).toBeCalledTimes(8);
    });

    test('findKyverno() - change access permissions and find the kyverno in given directory', () => {
        jest.spyOn(util, 'chmodSync').mockImplementation(() => { });
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => {
            if (file == 'mainFolder') return ['kyverno.exe'];
        });
        jest.spyOn(util, 'statSync').mockImplementation((file) => {
            const isDirectory = (file as string).indexOf('folder') == -1 ? false : true
            return { isDirectory: () => isDirectory } as fs.Stats;
        });
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');

        expect(cliSetup.findKyverno('mainFolder')).toBe(path.join('mainFolder', 'kyverno.exe'));
    });

    test('findKyverno() - throw error if executable not found', () => {
        jest.spyOn(util, 'chmodSync').mockImplementation(() => { });
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => {
            if (file == 'mainFolder') return [];
        });
        jest.spyOn(util, 'statSync').mockImplementation((file) => { return { isDirectory: () => true } as fs.Stats });
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');
        expect(() => cliSetup.findKyverno('mainFolder')).toThrow('Kyverno executable not found in path mainFolder');
    });

    test('downloadKyverno() - download kyverno and return path to it', async () => {
        jest.spyOn(toolCache, 'find').mockReturnValue('');
        jest.spyOn(toolCache, 'downloadTool').mockResolvedValue('pathToTool');
        const response = JSON.stringify([{ 'tag_name': 'v4.0.0' }]);
        jest.spyOn(util, 'readFileSync').mockReturnValue(response);
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');
        jest.spyOn(util, 'chmodSync').mockImplementation(() => { });
        jest.spyOn(toolCache, 'extractZip').mockResolvedValue('pathToUnzippedKyverno');
        jest.spyOn(toolCache, 'cacheDir').mockResolvedValue('pathToCachedDir');
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => ['kyverno.exe']);
        jest.spyOn(util, 'statSync').mockImplementation((file) => {
            const isDirectory = (file as string).indexOf('folder') == -1 ? false : true
            return { isDirectory: () => isDirectory } as fs.Stats;
        });

        expect(await cliSetup.downloadKyverno(null)).toBe(path.join('pathToCachedDir', 'kyverno.exe'));
        expect(toolCache.find).toBeCalledWith('kyverno', 'v4.0.0');
        expect(toolCache.downloadTool).toBeCalledWith('https://github.com/kyverno/kyverno/releases/download/v4.0.0/kyverno-cli_v4.0.0_windows_x86_64.zip');
        expect(util.chmodSync).toBeCalledWith('pathToTool', '777');
        expect(toolCache.extractZip).toBeCalledWith('pathToTool');
        expect(util.chmodSync).toBeCalledWith(path.join('pathToCachedDir', 'kyverno.exe'), '777');
    });

    test('downloadKyverno() - throw error if unable to download', async () => {
        jest.spyOn(toolCache, 'find').mockReturnValue('');
        jest.spyOn(toolCache, 'downloadTool').mockImplementation(async () => { throw 'Unable to download' });
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');

        await expect(cliSetup.downloadKyverno('v1.4.3')).rejects.toThrow('Failed to download Kyverno from location https://github.com/kyverno/kyverno/releases/download/v1.4.3/kyverno-cli_v1.4.3_windows_x86_64.zip');
        expect(toolCache.find).toBeCalledWith('kyverno', 'v1.4.3');
        expect(toolCache.downloadTool).toBeCalledWith('https://github.com/kyverno/kyverno/releases/download/v1.4.3/kyverno-cli_v1.4.3_windows_x86_64.zip');
    });

    test('downloadKyverno() - return path to kyverno tool with same version from toolCache', async () => {
        jest.spyOn(toolCache, 'find').mockReturnValue('pathToCachedDir');
        jest.spyOn(util, 'chmodSync').mockImplementation(() => { });

        expect(await cliSetup.downloadKyverno('v1.4.3')).toBe(path.join('pathToCachedDir', 'kyverno.exe'));
        expect(toolCache.find).toBeCalledWith('kyverno', 'v1.4.3');
        expect(util.chmodSync).toBeCalledWith(path.join('pathToCachedDir', 'kyverno.exe'), '777');
    });

    test('downloadKyverno() - throw error is kyverno is not found in path', async () => {
        jest.spyOn(toolCache, 'find').mockReturnValue('');
        jest.spyOn(toolCache, 'downloadTool').mockResolvedValue('pathToTool');
        jest.spyOn(util, 'osType').mockReturnValue('Windows_NT');
        jest.spyOn(util, 'chmodSync').mockImplementation();
        jest.spyOn(toolCache, 'extractZip').mockResolvedValue('pathToUnzippedKyverno');
        jest.spyOn(toolCache, 'cacheDir').mockResolvedValue('pathToCachedDir');
        jest.spyOn(util, 'readdirSync').mockImplementation((file, _) => []);
        jest.spyOn(util, 'statSync').mockImplementation((file) => {
            const isDirectory = (file as string).indexOf('folder') == -1 ? false : true
            return { isDirectory: () => isDirectory } as fs.Stats;
        });

        await expect(cliSetup.downloadKyverno('v1.4.3')).rejects.toThrow('Kyverno executable not found in path pathToCachedDir');
        expect(toolCache.find).toBeCalledWith('kyverno', 'v1.4.3');
        expect(toolCache.downloadTool).toBeCalledWith('https://github.com/kyverno/kyverno/releases/download/v1.4.3/kyverno-cli_v1.4.3_windows_x86_64.zip');
        expect(util.chmodSync).toBeCalledWith('pathToTool', '777');
        expect(toolCache.extractZip).toBeCalledWith('pathToTool');
    });
});