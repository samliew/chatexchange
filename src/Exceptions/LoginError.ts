import { CookieJar } from "tough-cookie";
import ChatExchangeError from "./ChatExchangeError";

export interface LoginErrorInfo {
    email?: string;
    password?: string;
    cookie?: string | CookieJar.Serialized;
}

export interface LoginError extends LoginErrorInfo {}

export class LoginError extends ChatExchangeError {
    constructor(message: string, info: LoginErrorInfo) {
        super(message);
        Object.assign(this, info);
    }
}

export default LoginError;
