function exactChildEnvironment(environment) {
    const exact = {};
    for (const key of Object.keys(process.env))
        exact[key] = undefined;
    for (const [key, value] of Object.entries(environment))
        exact[key] = value;
    return exact;
}
export function createDshWorkerSpawner(subprocess) {
    return {
        spawn(spec) {
            return subprocess.spawn({
                argv: spec.argv,
                cwd: spec.cwd,
                stdio: { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
                graceMs: spec.graceMs,
                env: exactChildEnvironment(spec.environment),
            });
        },
    };
}
//# sourceMappingURL=dsh-spawner.js.map