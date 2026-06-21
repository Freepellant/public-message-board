import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Message {
    id: bigint;
    content: string;
    sender: string;
    timestamp: bigint;
}
export interface HttpRequest {
    url: string;
    method: string;
    body: Uint8Array;
    headers: Array<HeaderField>;
    certificate_version?: number;
}
export interface HttpResponse {
    body: Uint8Array;
    headers: Array<HeaderField>;
    upgrade?: boolean;
    status_code: number;
}
export type HeaderField = [string, string];
export interface backendInterface {
    addMessage(sender: string, content: string): Promise<void>;
    getMessages(): Promise<Array<Message>>;
    http_request(req: HttpRequest): Promise<HttpResponse>;
    http_request_update(req: HttpRequest): Promise<HttpResponse>;
}
