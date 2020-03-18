// const { registerTest } = require("../tsc-test.js") as typeof import("../tsc-test");
import { registerTest } from "tsc-test";

registerTest({
	name: "One equals one",
	func: async (assert) =>
	{
		assert.equals(1, 1);
	}
});
