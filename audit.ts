interface Line {
	text: string;
	num: number;
	start: number;
	end: number;
}

interface LineWithTimeStamp extends Line {
	timeStamp?: string;
}

interface Audit {
	name: string;
	doAudit(lines: LineWithTimeStamp[]): IterableIterator<AuditPluginResult>;
	// renderAuditDetails(result: AuditResult, container: HTMLElement): void;
}

interface AuditPluginResult {
	text: string;
	messageNum: number;
	timeStamp?: string;
}

export interface AuditResult extends AuditPluginResult {
	auditName: string;
}

class ErrorAudit implements Audit
{
	public get name() { return "Errors"; }

	public *doAudit(logMessages: LineWithTimeStamp[]): IterableIterator<AuditPluginResult>
	{
		for (let line of logMessages)
		{
			if (/\sERROR/.test(line.text))
			{
				const errorTextPreview = /\[.+\]\s+(.*)$/m.exec(line.text)?.[1] ?? "Couldn't find error text";
				yield {
					text: errorTextPreview,
					messageNum: line.num,
					timeStamp: line.timeStamp
				};

			}
		}
	}
}

class SqlQueryAudit implements Audit
{
	public get name() { return "SQL Statements"; }

	public *doAudit(logMessages: LineWithTimeStamp[]): IterableIterator<AuditPluginResult>
	{
		for (let line of logMessages)
		{
			if (/SQL Stmt:/.test(line.text))
			{
				const errorTextPreview = "SQL query executed";
				yield {
					text: errorTextPreview,
					messageNum: line.num,
					timeStamp: line.timeStamp
				};
			}
		}
	}
}

const audits = [
	new ErrorAudit(),
	new SqlQueryAudit(),
] as Audit[];


export function runAudits(text: string)
{
	// MOVE THIS TO A WORKER!!
	const linePrefixPattern = /\d{1,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2},\d{3}/;
	const timeStampPattern = /\d{1,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2},\d{3}/;
	const regex = new RegExp(linePrefixPattern, "g");

	const matches = [];
	let match;
	while (match = regex.exec(text))
		matches.push(match);

	const logMessages = [] as LineWithTimeStamp[];
	for (let matchNum = 0; matchNum < matches.length; matchNum++)
	{
		const lineStart = matches[matchNum].index;
		const lineEnd = matches[matchNum + 1]?.index ?? text.length;
		const lineText = text.substring(lineStart, lineEnd);
		const timeStamp = lineText.match(timeStampPattern)?.[0];

		logMessages.push( { text: lineText, num: matchNum, start: lineStart, end: lineEnd, timeStamp });
	}

	let results = [] as AuditResult[];
	for (let audit of audits)
	{
		for (let result of audit.doAudit(logMessages))
		{
			results.push({
				...result,
				auditName: audit.name
			});
		}
	}

	return results;
}
