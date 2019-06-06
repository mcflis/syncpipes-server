declare module 'jira-connector' {
    export = JiraClient;

    interface Myself {
        self: string,
        key: string,
        name: string,
        emailAddress: string,
        displayName: string,
        active: boolean,
        timeZone: string
    }

    class MyselfClient {
        public getMyself(opts?: any, callback?: (err: Error, myself: Myself) => void): Promise<Myself>;
    }

    interface JiraClient {
        myself: MyselfClient;
    }

    class JiraClient {
        constructor(opts: JiraClientOpts);
    }

    interface JiraClientOpts {
        host: string;
        port?: string,
        protocol?: string,
        path_prefix?: string;
        basic_auth?: {
            username: string,
            password: string
        }
    }
}