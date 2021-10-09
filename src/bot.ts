const Discord = require("discord.js");
const auth = require("../auth.json");
const fetch = require("node-fetch");
const SuperExpressive = require("super-expressive");
const client = new Discord.Client();
const checkIntervalMinutes = 30;
const { prefix } = require("../config.json");

class Version {
  major: number = 0;
  minor: number = 0;
  date: string;
  notes: Array<string> = [];

  constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
  }

  public print() {
    return `https://ark.gamepedia.com/Xbox_${this.major}.${this.minor}`;
  }
}

class PatchNotes {
  client;
  versions: Array<Version> = [];
  newestVersion = new Version(0, 0);

  constructor(client) {
    this.client = client;
  }

  sendMessage(message: string) {
    const channel = [...client.channels.cache].find(
      (a) =>
        a[1]?.type === "text" && a[1]?.name?.indexOf("ark-patch-notes") !== -1
    )[1]; //[1] for channel object
    channel.send(message);
  }

  public async _checkForNewPatchNotes() {
    try {
      console.log("checking...");
      const response = await fetch("https://ark.gamepedia.com/Xbox_800.26");
      const html = await response.text();
      // const regex = SuperExpressive()
      //   .allowMultipleMatches.singleLine.string("<table")
      //   .zeroOrMoreLazy.anyChar.capture.zeroOrMore.string("<a")
      //   .end()
      //   .toRegex();
      const regex = SuperExpressive()
        .allowMultipleMatches.string('<a href="/wiki/Xbox_')
        .capture.oneOrMore.anyOf.range("0", "9")
        .string(".")
        .end()
        .end()
        .toRegex();
      // console.log([...html.matchAll(regex)]?.length);
      // console.log([...html.matchAll(regex)]?.[0].length);

      this.versions = [...html.matchAll(regex)]
        ?.map(
          (o) =>
            new Version(Number(o[1].split(".")[0]), Number(o[1].split(".")[1]))
        )
        .sort(
          (a, b) =>
            a.major !== b.major ? a.major - b.major : a.minor - b.minor
          // ? Number(a.minor.toString()[1]) - Number(b.minor.toString()[1])
          // : Number(a.minor.toString()[0]) - Number(b.minor.toString()[0])
        );

      const newestVersion = this.versions[this.versions.length - 1] ?? 0;
      if (
        !this.newestVersion ||
        newestVersion.major > this.newestVersion.major
      ) {
        if (this.newestVersion.major !== 0) {
        this.sendMessage(`Latest:\n${newestVersion.print()}`);
        } else {
        console.log(
        `newest version found but not sent (startup) ${newestVersion.print()}`
        );
        }
        this.newestVersion = newestVersion;
        await this._retrieveNewPatchNotes(this.newestVersion);
      }
    } catch (error) {
      console.log(error);
    }
  }

  public async _retrieveNewPatchNotes(version: Version) {
    if (version.notes?.length) return;
    try {
      console.log("checking for newest notes...");
      const response = await fetch(
        `https://ark.gamepedia.com/wiki/Xbox_${version.major}.${version.minor}`
      );
      const html = await response.text();
      const regex = SuperExpressive()
        .allowMultipleMatches
        .string("<b>Released</b> - ")
        .capture.oneOrMoreLazy.anyChar.end()
        .oneOrMore.anyOf.newline.string("</p>")
        .string("<ul><li>")
        .end()
        .capture.oneOrMoreLazy.anyOf.newline.oneOrMoreLazy.anyChar.end()
        .end()
        .anyOf.string("</li></ul>")
        .end()
        .toRegex();
      const search = [...html.matchAll(regex)]?.[0];
      const date = search?.[1];
      const notes = search?.[2].split("</li>\n<li>");
      console.log(`notes:${notes}`);
      version.date = date;
      version.notes = notes;
    } catch (error) {
      console.log(error);
    }
  }
}
const patchNotes = new PatchNotes(client);
client.once("ready", () => {
  console.log("Ready2!");
  patchNotes._checkForNewPatchNotes();
  setInterval(
    () => patchNotes._checkForNewPatchNotes(),
    checkIntervalMinutes * 60000
  );
});

client.on("message", async (message) => {
  const prefixed = message.content.startsWith(prefix);
  const mentioned = message.mentions.users.has(client.user.id);
  if ((!prefixed && !mentioned) || message.author.bot) return;

  const args = prefixed
    ? message.content.slice(prefix.length).trim().split(/ +/)
    : message.content.split(/ +/).slice(1);
  const command = args.shift().toLowerCase();
  console.log(`command:${command}`);

  if (
    command === "latest" ||
    command === "latest-version" ||
    command === "notes" ||
    command === "patchnotes" ||
    command === "patch"
  ) {
    message.channel.send(
      patchNotes?.newestVersion?.print() ??
        "Sorry, I can't retrieve the latest patch notes ."
    );
  } else if (command === "version") {
    const major = Number(args[0]?.split(".")[0]);
    const minor = Number(args[0]?.split(".")[1]);
    console.log(major, minor);
    const version = patchNotes.versions.find(
      (o) => o.major == major && o.minor == minor
    );
    if (!version) {
      message.channel.send("invalid patchnotes version.");
      return;
    }

    //await patchNotes._retrieveNewPatchNotes(version);
    message.channel.send(version.print());
  } else if (command === "list") {
    message.channel.send(
      patchNotes.versions
        .reverse()
        .slice(1, 6)
        .map((o) => `${o.major}.${o.minor}`)
        .join("\n")
    );
  } else if (command === "help") {
    message.channel.send(
      `Command:\n\t${prefix}help >> show this help\n\t${prefix}latest >> show latest patch notes\n\t${prefix}list >> list last 5 patch note versions\n\t${prefix}xx.xx >> show patch notes xx.xx\n\t${prefix}version xx.xx >> show patch notes xx.xx\n\t${prefix}notes >> show latest patch notes\n\t${prefix}patch >> show latest patch notes\n\t${prefix}patchnotes >> show latest patch notes`
    );
  } else {
    const major = Number(command?.split(".")[0]);
    const minor = Number(command?.split(".")[1]);
    if (!major || !minor) return;

    const version = patchNotes.versions.find(
      (o) => o.major == major && o.minor == minor
    );
    if (!version) {
      message.channel.send("invalid patchnotes version.");
      return;
    }
    message.channel.send(version.print());
  }
  // other commands...
});

try {
  //patchNotes._checkForNewPatchNotes();
  client.login(auth.token);
} catch (error) {
  console.log(error);
}
