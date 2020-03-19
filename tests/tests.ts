import { registerTest } from "astr";

registerTest({
	name: "One equals one",
	func: async (assert) =>
	{
		assert.equals(1, 1);
	}
});
