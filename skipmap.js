import y18n from "y18n";
import BasePlugin from "./base-plugin.js";

export default class SkipMapVote extends BasePlugin {
  static get description() {
    return "Voting for skip maps";
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      language: {
        required: false,
        description: "Plugin language",
        default: "en",
      },
      startVoteCommand: {
        required: false,
        description: "Command for start",
        default: "skipmap",
      },
      ignoreChats: {
        required: false,
        description: "Skipped Chats",
        default: ["ChatTeam", "ChatSquad"],
      },
      endVoteTimer: {
        required: false,
        description: "Time to vote in seconds",
        default: 90,
      },
      activeTimeAfterNewMap: {
        required: false,
        description:
          "The time after the start of a new map at which the map skip is available in seconds",
        default: 180,
      },
      minPlayersForStart: {
        required: false,
        description:
          "The minimum number of players after which the map skip is active",
        default: 10,
      },
      minPlayersVotePercent: {
        required: false,
        description:
          "The minimum percentage of those who voted to recognize the result as valid, fractional value",
        default: 0.45,
      },
      minPositivelyVotesPercent: {
        required: false,
        description:
          "The percentage of positive votes out of the total number of those who voted in order to consider the vote valid, a fractional value",
        default: 0.65,
      },
      timeoutBeforeEndMatch: {
        required: false,
        description: "Time out before the end of the match in seconds",
        default: 7,
      },
      periodicallyMessageTimer: {
        required: false,
        description:
          "The time between messages about the voting process, in seconds",
        default: 10,
      },
      ignoreWhenPreviousMatchSkipped: {
        required: false,
        description:
          "Should we ignore the command when the previous map was skipped",
        default: true,
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.locale = y18n({
      locale: this.options.language,
      directory: "./squad-server/plugins/skipmap-locales",
    }).__;

    this.voteIsStarted = false;
    this.voteHasBeenStartedOnThisGame = false;
    this.previousMatchHasBeenSkipped = false;
    this.startTimeOfLastGame = new Date();
    this.votes = new Map();

    this.intervalMessageTimeout;
    this.endVoteTimeout;
    this.endMatchTimeout;

    this.onStartVoteCommand = this.onStartVoteCommand.bind(this);
    this.endVote = this.endVote.bind(this);
    this.periodicallyMessage = this.periodicallyMessage.bind(this);
    this.messageProcessing = this.messageProcessing.bind(this);
    this.endMatch = this.endMatch.bind(this);
  }

  isActiveTimeForVote() {
    // Is it possible to start voting now?
    return (
      (new Date() - this.startTimeOfLastGame) / 1000 <
      this.options.activeTimeAfterNewMap
    );
  }

  async sendWarn(player, message) {
    await this.server.rcon.warn(player.steamID, message);
  }

  async sendBroadcast(message) {
    await this.server.rcon.broadcast(message);
  }

  async endMatch() {
    await this.server.rcon.execute("AdminEndMatch");
  }

  async periodicallyMessage() {
    await this.sendBroadcast(
      this
        .locale`Are we skipping the map? +/- (${this.getVoteResults().join("/")})`
    );
  }

  getVoteResults() {
    let countAgainst = 0;
    let countPositively = 0;

    for (let vote of this.votes.values()) {
      vote ? countPositively++ : countAgainst++;
    }

    return [countPositively, countAgainst];
  }

  setVoteByMessage(data) {
    // Checking the message for voting + or -
    switch (data.message) {
      case "+":
        this.votes.set(data.player.steamID, true);
        return true;
      case "-":
        this.votes.set(data.player.steamID, false);
        return true;
    }
    return false;
  }

  async messageProcessing(data) {
    // Sometimes squadjs reacts to a player's message before adding him to the list of players
    if (data.player === null) {
      return;
    }

    // Checking messages and notification of vote acceptance
    let isVote = this.setVoteByMessage(data);

    if (isVote) {
      await this.sendWarn(data.player, this.locale`Your vote is accepted`);
    }
  }

  async startVote() {
    this.voteIsStarted = true;
    this.votes.clear();

    this.server.on("CHAT_MESSAGE", this.messageProcessing);

    await this.sendBroadcast(
      this
        .locale`Vote for skipping the map! + or - to chat, ${this.options.endVoteTimer} seconds`
    );

    this.endVoteTimeout = setTimeout(
      this.endVote,
      this.options.endVoteTimer * 1000
    );

    this.intervalMessageTimeout = setInterval(
      this.periodicallyMessage,
      this.options.periodicallyMessageTimer * 1000
    );
  }

  async endVote() {
    // The end of voting with the output of the results
    this.server.removeListener("CHAT_MESSAGE", this.messageProcessing);
    clearInterval(this.intervalMessageTimeout);
    this.voteHasBeenStartedOnThisGame = true;
    this.voteIsStarted = false;

    let minPlayersVote = Math.floor(
      this.server.a2sPlayerCount * this.options.minPlayersVotePercent
    );

    let [countPositively, countAgainst] = this.getVoteResults();

    let allVoted = this.votes.size;

    let minPlayersPositively = Math.floor(
      allVoted * this.options.minPositivelyVotesPercent
    );

    if (allVoted <= minPlayersVote) {
      await this.sendBroadcast(
        this
          .locale`There will be no skip, less than ${this.options.minPlayersVotePercent * 100}% of the players voted`
      );
      return;
    }

    if (countAgainst > countPositively) {
      await this.sendBroadcast(
        this
          .locale`There will be no skip, there will be fewer votes for than against. ${countPositively}/${countAgainst}`
      );
      return;
    }

    if (countPositively < minPlayersPositively) {
      await this.sendBroadcast(
        this
          .locale`There will be no skip, there must be more than ${this.options.minPositivelyVotesPercent * 100}% of the total number of votes in favor`
      );
      return;
    }

    await this.sendBroadcast(
      this.locale`Skipping the map! (${countPositively}/${countAgainst})`
    );

    this.endMatchTimeout = setTimeout(
      this.endMatch,
      this.options.timeoutBeforeEndMatch * 1000
    );
  }

  async onStartVoteCommand(data) {
    // Checking for the possibility of starting voting at the moment
    if (this.options.ignoreChats.includes(data.chat)) {
      await this.sendWarn(
        data.player,
        this
          .locale`In this chat, the command !${this.options.startVoteCommand} is unavailable`
      );
      return;
    }

    if (this.voteIsStarted) {
      await this.sendWarn(
        data.player,
        this.locale`The voting has already started`
      );
      return;
    }

    if (!this.isActiveTimeForVote()) {
      await this.sendWarn(
        data.player,
        this
          .locale`You can start voting only within ${this.options.activeTimeAfterNewMap} seconds after the start of the match`
      );
      return;
    }

    if (this.server.a2sPlayerCount < this.options.minPlayersForStart) {
      await this.sendWarn(
        data.player,
        this
          .locale`You can start voting from ${this.options.minPlayersForStart} of the players on the server`
      );
      return;
    }

    if (this.voteHasBeenStartedOnThisGame) {
      await this.sendWarn(
        data.player,
        this.locale`Voting has already taken place in this match`
      );
      return;
    }

    if (
      this.options.ignoreWhenPreviousMatchSkipped &&
      this.previousMatchHasBeenSkipped
    ) {
      await this.sendWarn(
        data.player,
        this.locale`The previous map has already been skipped, go play`
      );
      return;
    }

    await this.startVote();
  }

  async mount() {
    this.server.on("NEW_GAME", async () => {
      // if the map was played less than the timer + 5 minutes, then the previous game was skipped
      this.previousMatchHasBeenSkipped =
        this.options.activeTimeAfterNewMap * 1000 +
          this.options.endVoteTimer * 1000 +
          this.startTimeOfLastGame.valueOf() +
          5 * 60 * 1000 >
        Date.now();

      this.startTimeOfLastGame = new Date();
      this.voteIsStarted = false;
      this.voteHasBeenStartedOnThisGame = false;
      this.votes.clear();

      clearTimeout(this.endVoteTimeout);
      clearTimeout(this.endMatchTimeout);
      clearInterval(this.intervalMessageTimeout);
    });

    this.server.on(
      `CHAT_COMMAND:${this.options.startVoteCommand.toLowerCase()}`,
      this.onStartVoteCommand
    );
  }
}
