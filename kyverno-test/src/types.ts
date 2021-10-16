
export interface ClusterPolicy {
    metadata: {
        name: string;
    },
    spec: {
        rules: Rule[]
    }
}

export interface Rule {
    name: string,
    match?: {
        resources: {
            kinds: string[]
        }
    },
    exclude?: {
        resources: {
            kinds: string[]
        }
    },
    validate: {
        message: string,
        pattern?: unknown,
        anyPattern?: unknown
    }
}

export interface Resource {
    apiVersion: string,
    kind: string,
    metadata: {
        name: string;
    }
}

export interface Test {
    name: string;
    policies: string[];
    resources: string[];
    results: Array<{
        policy: string;
        rule: string;
        resource: string;
        status: string;
    }>
}
