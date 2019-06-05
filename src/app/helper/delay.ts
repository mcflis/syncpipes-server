export default function delay(ms): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}
