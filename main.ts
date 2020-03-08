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
		dirHandle = await window.chooseFileSystemEntries({ type: "open-directory" }) as FileSystemDirectoryHandle;

		console.log(JSON.stringify(dirHandle))

		fileListEntries.length = 0;

		for await (let e of dirHandle.getEntries())
			fileListEntries.push(e);

		// dirHandle.requestPermission({ writable: true });
		renderFileList();
	};

	logView = document.getElementById("file-display") as LogView;

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

	const lines = [] as Line[];
	for (let i = 0; i < matches.length; i++)
	{
		const lineStart = matches[i].index;
		const lineEnd = matches[i + 1]?.index ?? text.length;
		const lineText = text.substring(lineStart, lineEnd);

		lines.push( { text: lineText, num: i, start: lineStart, end: lineEnd });
	}

	let results = {} as { [auditName: string]: AuditResult[] };
	for (let audit of audits)
	{
		const r = audit.fn(lines);
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

			li.onclick = () => {
				goToLine(result.lineNum);
			};
		}
	}
}

function goToLine(lineNum: number)
{
	const codeArea = document.getElementById("file-display") as HTMLPreElement;
	const timestamps = [...codeArea.querySelectorAll(".token.timestamp")];

	timestamps[lineNum].scrollIntoView();
}

audits.push(
	{
		name: "Errors",
		fn: lines =>
		{
			const results = [];
			for (let line of lines)
			{
				if (/\sERROR/.test(line.text))
				{
					const errorTextPreview = /\[.+\]\s+(.*)$/m.exec(line.text)?.[1] ?? "Couldn't find error text";
					results.push({ text: errorTextPreview, lineNum: line.num });
				}
			}

			return results;
		}
	},
	{
		name: "SQL Statements",
		fn: lines =>
		{
			const results = [];
			for (let line of lines)
			{
				if (/SQL Stmt:/.test(line.text))
				{
					const errorTextPreview = "SQL query executed";
					results.push({ text: errorTextPreview, lineNum: line.num });
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
	lineNum: number;
}

interface Line {
	text: string;
	num: number;
	start: number;
	end: number;
}