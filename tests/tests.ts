import { registerTest } from "astr";
import { runAudits } from "../bin/audit.js";
import * as fs from "fs";

registerTest({
	name: "One equals one",
	func: async (assert) =>
	{
		const logText = fs.readFileSync("test-logs/ExagoStephen.log", { encoding: "utf8" });
		
		const audits = [];

		for await (let audit of runAudits(logText))
			audits.push(audit);

		
		// make some assertion about audits
		throw "NOT IMPLEMENTED";
	}
});
