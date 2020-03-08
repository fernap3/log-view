import { LogView } from "./log-view.js";

let dirHandle: FileSystemDirectoryHandle;
const fileListEntries = [] as FileSystemHandle[];
const audits = [] as Audit[];

const patternInput = document.getElementById("filename-pattern") as HTMLInputElement;
patternInput.onchange = () => renderFileList();

const linePrefixInput = document.getElementById("line-prefix-pattern") as HTMLInputElement;
linePrefixInput.onchange = () => renderFileContents();

let selectedFileHandle: FileSystemHandle;
let logView: LogView;

async function onPageLoad()
{
	const button = document.querySelector("button") as HTMLButtonElement;
	button.onclick = async () =>
	{
		try
		{
			dirHandle = await window.chooseFileSystemEntries({ type: "open-directory" }) as FileSystemDirectoryHandle;
		}
		catch (e)
		{
			// Chrome 80 is not spec compliant; this is fixed in Chrome 82
			dirHandle = await window.chooseFileSystemEntries({ type: "openDirectory" as any }) as FileSystemDirectoryHandle;
		}

		fileListEntries.length = 0;

		for await (let e of dirHandle.getEntries())
			fileListEntries.push(e);

		renderFileList();
	};

	logView = document.getElementById("file-display") as LogView;
	logView.highlighters = {
		"level": { pattern: /INFO|DEBUG|WARN/, style: { textColor: "#6f6f6f" } },
		"level-error": { pattern: /ERROR/, style: { textColor: "#c50000", bold: true } },
		"timestamp": { pattern: /\d{1,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2},\d{3}/, style: { textColor: "#000000" } },
	};

	logView.messageStartPattern = /\d{1,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2},\d{3}/; // timestamp
}

function renderFileList()
{
	const filenamePattern = patternInput.value;
	const entries = fileListEntries.filter(e => new RegExp(filenamePattern).test(e.name));
	
	const list = document.getElementById("file-list-items") as HTMLUListElement;

	list.innerHTML = "";
	
	for (let e of entries)
	{
		if (!e.isFile)
			continue;

		if (!new RegExp(filenamePattern).test(e.name))
			continue;
		
		const item = document.createElement("li");
		list.appendChild(item);
		
		item.textContent = e.name;
		item.onclick = () => {
			list.querySelectorAll("[data-selected]").forEach(e => e.removeAttribute("data-selected"));
			item.toggleAttribute("data-selected");
			renderFileContents(e);
			selectedFileHandle = e;
		};
	}
}

async function renderFileContents(entry = selectedFileHandle)
{
	const handle = await dirHandle.getFile(entry.name);
	const file = await handle.getFile();

	const fileText = await file.text();
	logView.value = fileText;
	logView.scrollTop = 0;

	const auditResults = runAudits(fileText);
	renderAudits(auditResults);
}

function runAudits(text: string)
{
	// MOVE THIS TO A WORKER!!
	console.time("audits")
	const linePrefixPattern = linePrefixInput.value;
	const regex = new RegExp(linePrefixPattern, "g");

	const matches = [];
	let match;
	while (match = regex.exec(text))
		matches.push(match);

	const logMessages = [] as Line[];
	for (let matchNum = 0; matchNum < matches.length; matchNum++)
	{
		const lineStart = matches[matchNum].index;
		const lineEnd = matches[matchNum + 1]?.index ?? text.length;
		const lineText = text.substring(lineStart, lineEnd);

		logMessages.push( { text: lineText, num: matchNum, start: lineStart, end: lineEnd });
	}

	let results = {} as { [auditName: string]: AuditResult[] };
	for (let audit of audits)
	{
		const r = audit.fn(logMessages);
		if (r.length)
			results[audit.name] = r;
	}

	console.timeEnd("audits")

	return results;
}

function renderAudits(results: { [auditName: string]: AuditResult[] })
{
	const auditsPane = document.getElementById("audits") as HTMLElement;
	auditsPane.innerHTML = "";

	const list = document.createElement("ul");
	auditsPane.appendChild(list);

	for (let auditName in results)
	{
		const auditListTitle = document.createElement("li");
		auditListTitle.textContent = auditName;
		list.appendChild(auditListTitle);
		const sublist = document.createElement("ul");
		list.appendChild(sublist);
		for (let result of results[auditName])
		{
			const li = document.createElement("li");
			sublist.appendChild(li);
			li.textContent = result.text;

			li.onclick = () => logView.scrollToMessage(result.messageNum);
		}
	}
}

audits.push(
	{
		name: "Errors",
		fn: logMessages =>
		{
			const results = [];
			for (let line of logMessages)
			{
				if (/\sERROR/.test(line.text))
				{
					const errorTextPreview = /\[.+\]\s+(.*)$/m.exec(line.text)?.[1] ?? "Couldn't find error text";
					results.push({ text: errorTextPreview, messageNum: line.num });
				}
			}

			return results;
		}
	},
	{
		name: "SQL Statements",
		fn: logMessages =>
		{
			const results = [];
			for (let line of logMessages)
			{
				if (/SQL Stmt:/.test(line.text))
				{
					const errorTextPreview = "SQL query executed";
					results.push({ text: errorTextPreview, messageNum: line.num });
				}
			}

			return results;
		}
	}
);

onPageLoad();

interface Audit {
	name: string;
	fn: (lines: { text: string, num: number }[]) => AuditResult[];
}

interface AuditResult {
	text: string;
	messageNum: number;
}

interface Line {
	text: string;
	num: number;
	start: number;
	end: number;
}