import * as fs from "fs";
import * as os from "os";

export function osType(): string {
    return os.type();
}

export function readFileSync(path: fs.PathOrFileDescriptor,
    options:
        | {
            encoding: BufferEncoding;
            flag?: string | undefined;
        }
        | BufferEncoding): string {
    return fs.readFileSync(path, options);
}

export function chmodSync(path: fs.PathLike, mode: fs.Mode): void {
    fs.chmodSync(path, mode);
}

export function readdirSync(path: fs.PathLike,
    options?:
        | {
            encoding: BufferEncoding | null;
            withFileTypes?: false | undefined;
        }
        | BufferEncoding
        | null): string[] {
    return fs.readdirSync(path, options);
}

export function statSync(path: fs.PathLike, options?: undefined): fs.Stats {
    return fs.statSync(path, options);
}
