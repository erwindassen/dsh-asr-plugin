import { FunAsrError } from "./errors.js";
import { loadFunAsrPunctuator } from "./punctuator.js";
import { loadFunAsrRecognizer } from "./recognizer.js";
export function createFunAsrRuntimeFactory(paths) {
    return {
        async loadPunctuator() {
            if (paths.punctuationConfigPath === undefined || paths.punctuationModelPath === undefined ||
                paths.punctuationTokensPath === undefined) {
                throw new FunAsrError("MODEL_LOAD_FAILED", "Enhanced mode requires punctuation assets");
            }
            return loadFunAsrPunctuator({
                configPath: paths.punctuationConfigPath,
                modelPath: paths.punctuationModelPath,
                tokensPath: paths.punctuationTokensPath,
            });
        },
        async loadRecognizer() {
            return loadFunAsrRecognizer({
                cmvnPath: paths.asrCmvnPath,
                configPath: paths.asrConfigPath,
                fbankPath: paths.fbankPath,
                modelPath: paths.asrModelPath,
                tokensPath: paths.asrTokensPath,
            });
        },
    };
}
//# sourceMappingURL=factory.js.map