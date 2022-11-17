/**
 * @summary builds a helper for mocking class exports
 * @param path path to the mocked module
 */
export const makeMockClassExport = <T>(path: string) => {
    /**
     * @param mockedProps a map property names to their mocks
     * @param name export name (defaults to "default")
     */
    return <U extends Partial<T>>(mockedProps: U, name = "default") => {
        // ensures the module state is reset between tests
        jest.dontMock(path);

        const actual = jest.requireActual(path);
        const mocked = actual[name];

        return jest.doMock(path, () => {
            const props: PropertyDescriptorMap = {};

            for (const [k, v] of Object.entries(mockedProps)) {
                const prop = Object.getOwnPropertyDescriptor(
                    mocked.prototype,
                    k
                );

                const descriptor: PropertyDescriptor = {
                    configurable: prop?.configurable,
                    enumerable: prop?.enumerable,
                    writable: prop?.writable,
                    value: v,
                };

                props[k] = descriptor;
            }

            Object.defineProperties(mocked.prototype, props);

            return {
                __esModule: true,
                ...actual,
                [name]: mocked,
            };
        });
    };
};
