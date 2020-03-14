import { LogView } from "./log-view.js";
import { AuditResultsList as AuditResultsList } from "./audit-results-list.js";
import { AuditResult, runAudits, audits } from "./audit.js";

let dirHandle: FileSystemDirectoryHandle;
const fileListEntries = [] as FileSystemHandle[];

const patternInput = document.getElementById("filename-pattern") as HTMLInputElement;
patternInput.onchange = () => renderFileList();

let selectedFileHandle: FileSystemHandle;
let logView: LogView;
let auditResultsList: AuditResultsList;
let auditDetailsContainer: HTMLElement;

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

	auditResultsList = document.querySelector("audit-results-list") as AuditResultsList;
	auditDetailsContainer = document.getElementById("audit-details") as HTMLElement;
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

	auditResultsList.onEntrySelect = (result: AuditResult, messageNum: number) => {
		logView.scrollToMessage(messageNum);

		const audit = audits.find(a => a.name === result.auditName)!;
		audit.renderAuditDetails(result, auditDetailsContainer);
	}

	const auditResults = [];
	for await (let result of runAudits(fileText))
		auditResults.push(result);

	auditResultsList.results = auditResults;
}

onPageLoad();
