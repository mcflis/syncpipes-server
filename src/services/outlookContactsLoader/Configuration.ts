import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * Exchange Configuration for this extension
 */
export class Configuration implements IServiceConfiguration {

    /**
     * Exchange Email, default: "kalender.sebis@tum.de"
     */
    public email: string;

    /**
     * Exchange MailBox, default: "kalender.sebis@tum.de"
     */
    public mailbox: string;

    /**
     * Exchange User, default: "ga54sop"
     */
    public user: string;

    /**
     * Exchange Password, default: "La1niaW9"
     */
    public password: string;

    /**
     * Exchange Password, default: "La1niaW9"
     */
    public serviceUrl: string;

    /**
     *
     * @return {{host: string, port: number, user: string, password: string, database: string}}
     */
    store(): Object {
        return {
            "email": this.email || 'kalender.sebis@tum.de',
            "mailbox": this.mailbox || 'kalender.sebis@tum.de',
            "user": this.user || 'ga54sop',
            "password": this.password || 'La1niaW9',
            "serviceUrl": this.serviceUrl || 'http://localhost:53415/',
            "multipleStatements": true
        };
    }

    /**
     * @param user
     * @param password
     * @param email
     * @param mailbox
     */
    load({user, password, email, mailbox, serviceUrl}): void {
        this.email = email;
        this.mailbox = mailbox;
        this.user = user;
        this.password = password;
        this.serviceUrl = serviceUrl;
    }


    getSchema(): ISchema {
        return Schema.createFromObject({
            "$schema": "http://json-schema.org/draft-0487/schema#",
            "type": "object",
            "properties": {
                "user": {
                    "type": "string",
                    "minLength": 1,
                    "default": "ga54sop"
                },
                "password": {
                    "type": "password",
                    "minLength": 1,
                    "default": "La1niaW9"
                },
                "email": {
                    "type": "string",
                    "minLength": 1,
                    "default": "kalender.sebis@tum.de"
                },
                "mailbox": {
                    "type": "string",
                    "default": "kalender.sebis@tum.de"
                },
                "serviceUrl": {
                    "type": "string",
                    "default": "http://localhost:53415/"
                }
            },
            "required": [
                "email",
                "mailbox",
                "user",
                "password",
                "serviceUrl"
            ]
        });
    }
}
