export default function isEmpty(obj: unknown) {
    return JSON.stringify(obj) === '{}';
}
