module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	transform: {
		'^.+\\.ts$': 'esbuild-jest',
	},
	moduleNameMapper: {
		'^src/(.*)$': '<rootDir>/src/$1',
		'^typings/(.*)$': '<rootDir>/typings/$1',
	},
};
