export default <T>(arr: T[]) => arr.filter((x) => x) as NonNullable<T>[];
