declare var Prism: typeof import("prismjs");

interface Line {
	text: string;
	num: number;
	start: number;
	end: number;
}

interface LineWithTimeStamp extends Line {
	timeStamp?: string;
}

interface Audit<T> {
	name: string;
	cssIncludes: string[];
	doAudit(lines: LineWithTimeStamp[]): IterableIterator<AuditPluginResult<T>>;
	renderAuditDetails(result: AuditResult<T>, container: HTMLElement): Promise<void>;
}

interface AuditPluginResult<T> {
	summary: string;
	messageNum: number;
	timeStamp?: string;
	renderData: T;
}

export interface AuditResult<T> extends AuditPluginResult<T> {
	auditName: string;
}

type ErrorAuditRenderDataType = string;
class ErrorAudit implements Audit<ErrorAuditRenderDataType>
{
	public get name() { return "Errors"; }
	public get cssIncludes() { return [] };

	public *doAudit(logMessages: LineWithTimeStamp[]): IterableIterator<AuditPluginResult<ErrorAuditRenderDataType>>
	{
		for (let line of logMessages)
		{
			if (/\sERROR/.test(line.text))
			{
				const errorTextPreview = /\[.+\]\s+(.*)$/m.exec(line.text)?.[1] ?? "Couldn't find error text";
				const fullMessageText = /\[.+\]\s+([\s\S]*)/m.exec(line.text)?.[1] ?? "Couldn't find full error message text";
				yield {
					summary: errorTextPreview,
					messageNum: line.num,
					timeStamp: line.timeStamp,
					renderData: fullMessageText
				};
			}
		}
	}

	public async renderAuditDetails(result: AuditResult<ErrorAuditRenderDataType>, container: HTMLElement)
	{
		const pre = document.createElement("pre");
		container.appendChild(pre);
		pre.innerHTML = result.renderData.trim();
	}
}

type SqlQueryAuditRenderDataType = string;
class SqlQueryAudit implements Audit<SqlQueryAuditRenderDataType>
{
	public get name() { return "SQL Statements"; }
	public get cssIncludes() { return ["prism.css"] };

	public *doAudit(logMessages: LineWithTimeStamp[]): IterableIterator<AuditPluginResult<SqlQueryAuditRenderDataType>>
	{
		for (let line of logMessages)
		{
			if (/SQL Stmt:/.test(line.text))
			{
				const sqlQuery = /\[.+\]\s+SQL Stmt: (.*)/m.exec(line.text)?.[1] ?? "Couldn't find SQL query text";
				yield {
					summary: sqlQuery,
					messageNum: line.num,
					timeStamp: line.timeStamp,
					renderData: sqlQuery
				};
			}
		}
	}

	public async renderAuditDetails(result: AuditResult<SqlQueryAuditRenderDataType>, container: HTMLElement)
	{
		await import("./prism.js" as any);

		const codeContainer = document.createElement("pre");
		container.appendChild(codeContainer);
		codeContainer.innerHTML = result.renderData;
		codeContainer.className = "language-sql";
		Prism.highlightElement(codeContainer);
	}
}

export const audits = [
	new ErrorAudit(),
	new SqlQueryAudit(),
] as Audit<any>[];


export async function *runAudits(text: string)
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

	for (let audit of audits)
	{
		for (let result of audit.doAudit(logMessages))
		{
			yield {
				...result,
				auditName: audit.name
			};
		}
	}
}
