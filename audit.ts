declare var Prism: typeof import("prismjs");
declare var sqlFormatter: typeof import("sql-formatter").default;

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

interface AuditResultLevelDescriptor
{
	level: "info" | "warning" | "severe";
	reason?: string;
}

interface AuditPluginResult<T> {
	summary: string;
	messageNum: number;
	timeStamp?: string;
	renderData: T;
	resultLevel: AuditResultLevelDescriptor;
}

export interface AuditResult<T> extends AuditPluginResult<T> {
	auditName: string;
}

type ErrorAuditRenderDataType = string;
class ErrorAudit implements Audit<ErrorAuditRenderDataType>
{
	public get name() { return "Error"; }
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
					renderData: fullMessageText,
					resultLevel: { level: "severe" }
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

type SqlQueryAuditRenderDataType = { query: string, numRows?: number };
class SqlQueryAudit implements Audit<SqlQueryAuditRenderDataType>
{
	public get name() { return "SQL Statement"; }
	public get cssIncludes() { return ["prism.css"] };

	private static readonly NUM_ROWS_WARNING_THRESHOLD = 500_000;

	public *doAudit(logMessages: LineWithTimeStamp[]): IterableIterator<AuditPluginResult<SqlQueryAuditRenderDataType>>
	{
		
		for (let i = 0; i < logMessages.length; i++)
		{
			const message = logMessages[i];
			
			if (/SQL Stmt:/.test(message.text))
			{
				const matches = /[^\[]\[([^\]]+)\]\[([^\]]+)\].+SQL Stmt: (.*)/m.exec(message.text);
				let numRows: number | undefined;

				const reportId = matches?.[1];
				const sessionId = matches?.[2];

				if (reportId && sessionId)
				{
					// Go find the log message that says how many rows were returned (if it exists).
					// We pass in the report ID and session ID logged in the SQL query message and
					// only look for a corresponding row count message where those two IDs match.
					numRows = this.findQueryRowsReturned(logMessages, reportId, sessionId, i + 1);
				}
				
				const largeNumberOfRowsReturned = (numRows ?? 0) > SqlQueryAudit.NUM_ROWS_WARNING_THRESHOLD;

				const query = matches?.[3] ?? "Couldn't find SQL query text";
				yield {
					summary: query,
					messageNum: message.num,
					timeStamp: message.timeStamp,
					renderData: { query, numRows },
					resultLevel: largeNumberOfRowsReturned ? {
							level: "warning",
							reason: `This query returned ${numRows} records`,
						} : {
							level: "info",
						}
				};
			}
		}
	}

	private findQueryRowsReturned(messages: LineWithTimeStamp[], reportId: string, sessionId: string, start: number): number | undefined
	{
		const numRowsRegex = /SQL Stmt rows returned:\s*(\d{1,10})/m;
		const idsRegex = new RegExp(`\\[${reportId}\\]\\s*\\[${sessionId}\\]`);

		for (let i = start; i < messages.length; i++)
		{
			const message = messages[i];

			if (idsRegex.test(message.text))
			{
				// The report ID and session ID from the log message match, so we are probably dealing with
				// the corresponding row count output for the given query
				const numRowsMatches = numRowsRegex.exec(message.text);

				if (numRowsMatches?.[1])
					return parseInt(numRowsMatches?.[1]);
			}
		}

		return undefined;
	}

	public async renderAuditDetails(result: AuditResult<SqlQueryAuditRenderDataType>, container: HTMLElement)
	{
		await import("./prism.js" as any);
		await import("./node_modules/sql-formatter/dist/sql-formatter.js" as any);


		const panelContainer = document.createElement("div");
		container.appendChild(panelContainer);
		panelContainer.style.display = "flex";
		panelContainer.style.height = "100%";

		const infoContainer = document.createElement("div");
		panelContainer.appendChild(infoContainer);
		infoContainer.style.flexBasis = "600px";

		const numRowsFormat = Intl.NumberFormat("en-us", { useGrouping: true });
		const formattedNumRows = result.renderData.numRows ? numRowsFormat.format(result.renderData.numRows) : "an unknown number of";
		
		const largeNumberOfRowsReturned = (result.renderData.numRows ?? 0) > SqlQueryAudit.NUM_ROWS_WARNING_THRESHOLD;
		if (largeNumberOfRowsReturned)
		{
			infoContainer.innerHTML = `
				<p>A SQL query was executed at ${result.timeStamp ?? "(unknown time)"}</p>
				<p>
					The query returned <span style="color:red;font-weight:bold;">${formattedNumRows}</span> rows. This is likely to cause application performance issues.
				</p>
			`;
		}
		else
		{
			infoContainer.innerHTML = `
				<p>A SQL query was executed at ${result.timeStamp ?? "(unknown time)"}</p>
				<p>The query returned ${formattedNumRows} rows</p>
			`;
		}

		const formattedSql = sqlFormatter.format(result.renderData.query);
		const codeContainer = document.createElement("pre");
		panelContainer.appendChild(codeContainer);
		codeContainer.innerHTML = formattedSql;
		codeContainer.className = "language-sql";
		codeContainer.style.flexGrow = "1";
		codeContainer.style.overflow = "auto";
		codeContainer.style.height = "100%";
		codeContainer.style.boxSizing = "border-box";

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
