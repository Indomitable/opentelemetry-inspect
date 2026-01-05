export const getSeverityType = (severity: string) => {
    switch (severity.toLowerCase()) {
        case "info":
        case "information": {
            return "info";
        }
        case "warn":
        case "warning": {
            return "warn";
        }
        case "error": {
            return "error";
        }
        case "critical":
        case "fatal": {
            return "critical";
        }
        case "debug":
        case "trace": {
            return "debug";
        }
        default: {
            return "";
        }
    }
}
