import { once } from "node:events";
export const MAX_FRAME_PAYLOAD_BYTES = 32 * 1024 * 1024;
export class FrameProtocolError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "FrameProtocolError";
        this.code = code;
    }
}
function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertPayloadLength(byteLength) {
    if (byteLength < 1 || byteLength > MAX_FRAME_PAYLOAD_BYTES) {
        throw new FrameProtocolError("INVALID_FRAME_LENGTH", "Worker frame payload length is outside the protocol boundary");
    }
}
function encodeJson(value) {
    let json;
    try {
        json = JSON.stringify(value);
    }
    catch (error) {
        throw new FrameProtocolError("INVALID_JSON", "Worker frame cannot be encoded", { cause: error });
    }
    const payload = Buffer.from(json);
    assertPayloadLength(payload.byteLength);
    return payload;
}
export function encodeFrame(value) {
    const payload = encodeJson(value);
    const frame = Buffer.allocUnsafe(4 + payload.byteLength);
    frame.writeUInt32BE(payload.byteLength, 0);
    payload.copy(frame, 4);
    return frame;
}
function decodePayload(payload) {
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    }
    catch (error) {
        throw new FrameProtocolError("INVALID_UTF8", "Worker frame is not valid UTF-8", { cause: error });
    }
    let value;
    try {
        value = JSON.parse(text);
    }
    catch (error) {
        throw new FrameProtocolError("INVALID_JSON", "Worker frame is not valid JSON", { cause: error });
    }
    if (!isJsonObject(value)) {
        throw new FrameProtocolError("INVALID_JSON_ROOT", "Worker frame root must be an object");
    }
    return value;
}
export async function* decodeFrames(stream) {
    let buffered = Buffer.alloc(0);
    let payloadLength;
    for await (const rawChunk of stream) {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        buffered = buffered.byteLength === 0 ? chunk : Buffer.concat([buffered, chunk]);
        while (true) {
            if (payloadLength === undefined) {
                if (buffered.byteLength < 4)
                    break;
                payloadLength = buffered.readUInt32BE(0);
                assertPayloadLength(payloadLength);
                buffered = buffered.subarray(4);
            }
            if (buffered.byteLength < payloadLength)
                break;
            const payload = buffered.subarray(0, payloadLength);
            buffered = buffered.subarray(payloadLength);
            payloadLength = undefined;
            yield decodePayload(payload);
        }
    }
    if (payloadLength !== undefined || buffered.byteLength !== 0) {
        throw new FrameProtocolError("TRUNCATED_FRAME", "Worker stream ended inside a frame");
    }
}
export async function writeFrame(stream, value) {
    const frame = encodeFrame(value);
    if (!stream.write(frame))
        await once(stream, "drain");
    return frame.byteLength;
}
//# sourceMappingURL=framing.js.map