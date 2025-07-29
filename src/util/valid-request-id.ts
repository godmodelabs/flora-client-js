export default function validRequestId(id: unknown) {
    switch (typeof id) {
        case "number":
            return !isNaN(id) && isFinite(id);
        case "string":
            return true;
        default: 
            return false;
    }
};
