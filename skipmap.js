import BasePlugin from './base-plugin.js';

export default class SkipMapVote extends BasePlugin {
  static get description() {
    return (
      'Голосовалка за скип карты'
    );
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      startVoteCommand: {
        required: false,
        description: 'Команда начала голосования',
        default: 'skipmap'
      },
      startVoteMessage: {
        required: false,
        description: 'Сообщение после начала голосования',
        default: 'Голосование за скип карты! + или - в чат'
      },
      ignoreChats: {
        required: false,
        description: 'Пропускаемые чаты',
        default: ['ChatTeam', 'ChatSquad']
      },
      endVoteTimer: {
        required: false,
        description: 'Время на голосование в секундах',
        default: 90
      },
      activeTimeAfterNewMap: {
        required: false,
        description: 'Время после начала новой карты в которое доступен скип карты в секундах',
        default: 180
      },
      minPlayersForStart: {
        required: false,
        description: 'Минимальное количество игроков после которого активен скип карты',
        default: 10
      },
      minPlayersVotePercent: {
        required: false,
        description: 'Минимальный процент проголосовавших для зачета результата, дробное значение',
        default: 0.30
      },
      timeoutBeforeEndMatch: {
        required: false,
        description: 'Таймаут перед завершением матча в секундах',
        default: 7
      },
      periodicallyMessageTimer: {
        required: false,
        description: 'Время между сообщениями о ходе голосования, в секундах',
        default: 15
      },
      periodicallyMessageText: {
        required: false,
        description: 'Текст периодического сообщения',
        default: 'Скип? +/-'
      },
      ignoreWhenPreviousMatchSkipped: {
        required: false,
        description: 'Игнорировать ли команду когда предыдущая карта была скипнута',
        default: true
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

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
    // Можно ли сейчас запускать голосование?
    return (new Date() - this.startTimeOfLastGame) / 1000 < this.options.activeTimeAfterNewMap;
  }

  async sendWarn(player, message) {
    await this.server.rcon.warn(player.steamID, message);
  }

  async sendBroadcast(message) {
    await this.server.rcon.broadcast(message);
  }

  async endMatch() {
    await this.server.rcon.execute('AdminEndMatch')
  }

  async periodicallyMessage() {
    // Отправка периодического сообщения
    await this.sendBroadcast(
      this.options.periodicallyMessageText + ' (' + this.getVoteResults().join('/') + ')'
    );
  }

  getVoteResults() {
    // Получение текущих результатов голосования
    let countAgainst = 0;
    let countPositively = 0;

    for (let vote of this.votes.values()){
      vote ? countPositively++ : countAgainst++;
    }

    return [countPositively, countAgainst]
  }

  setVoteByMessage(data) {
    // Проверка сообщения на наличие голосования + или -
    switch (data.message) {
      case '+':
        this.votes.set(data.player.steamID, true);
        return true;
      case '-':
        this.votes.set(data.player.steamID, false);
        return true;
    }
    return false
  }

  async messageProcessing(data) {
    // Проверка сообщений и уведомление о принятии голоса
    let isVote = this.setVoteByMessage(data);

    if (isVote) {
      await this.sendWarn(data.player, 'Ваш голос принят');
    }
  }

  async startVote() {
    // Запуск голосования
    this.voteIsStarted = true;
    this.votes.clear();

    this.server.on('CHAT_MESSAGE', this.messageProcessing);

    await this.sendBroadcast(this.options.startVoteMessage + ', '
                             + this.options.endVoteTimer
                             + ' секунд');

    this.endVoteTimeout = setTimeout(this.endVote,
                                     this.options.endVoteTimer * 1000);

    this.intervalMessageTimeout = setInterval(
      this.periodicallyMessage,
      this.options.periodicallyMessageTimer * 1000
    );
  }

  async endVote() {
    // Окончание голосования с выводом результатов
    this.server.removeListener('CHAT_MESSAGE', this.messageProcessing);
    clearInterval(this.intervalMessageTimeout);
    this.voteHasBeenStartedOnThisGame = true;
    this.voteIsStarted = false;

    let minPlayersVote = Math.floor(
      this.server.a2sPlayerCount * this.options.minPlayersVotePercent
    )

    let [countPositively, countAgainst] = this.getVoteResults()

    let allVoted = this.votes.size

    if (allVoted <= minPlayersVote){
      await this.sendBroadcast(
        `Скипа не будет, проголосовало меньше ${this.options.minPlayersVotePercent * 100}% игроков`
      )
      return
    }

    if (countAgainst > countPositively) {
      await this.sendBroadcast(
        `Скипа не будет, голосов 'за' меньше чем 'против'. ${countPositively}/${countAgainst}`
      )
      return
    }

    await this.sendBroadcast(
      `СКИП! ${countPositively}/${countAgainst}`
    )

    this.endMatchTimeout = setTimeout(this.endMatch,
                                      this.options.timeoutBeforeEndMatch * 1000)
  }

  async onStartVoteCommand(data) {
    // Проверка на возможность запуска голосования на текущий момент
    if (this.options.ignoreChats.includes(data.chat)) {
      await this.sendWarn(
        data.player,
        `В данном чате команда !${this.options.startVoteCommand} недоступна`
      );
      return;
    }

    if (this.voteIsStarted) {
      await this.sendWarn(data.player, 'Голосование уже начато');
      return;
    }

    if (!this.isActiveTimeForVote()) {
      await this.sendWarn(data.player,
        `Начать голосование можно лишь в течении ${this.options.activeTimeAfterNewMap} секунд после старта матча`);
      return;
    }

    if (this.server.a2sPlayerCount < this.options.minPlayersForStart) {
      await this.sendWarn(data.player,
        `Начать голосование можно от ${this.options.minPlayersForStart} игроков на сервере`);
      return;
    }

    if (this.voteHasBeenStartedOnThisGame) {
      await this.sendWarn(data.player,
        'В этом матче голосование уже проходило');
      return;
    }

    if (this.options.ignoreWhenPreviousMatchSkipped && this.previousMatchHasBeenSkipped) {
      await this.sendWarn(data.player,
        'Предыдущая карта уже была скипнута, играй');
      return;
    }


    await this.startVote()
  }

  async mount() {
    this.server.on('NEW_GAME', async () => {
      // если карта игралась меньше таймера + 2 минуты то значит игру предыдущую скипнули
      this.previousMatchHasBeenSkipped = (
        this.options.activeTimeAfterNewMap * 1000
          + this.options.endVoteTimer * 1000
          + this.startTimeOfLastGame.valueOf()
          + 2 * 60 * 1000
        > Date.now()
      );

      this.startTimeOfLastGame = new Date();
      this.voteIsStarted = false;
      this.voteHasBeenStartedOnThisGame = false;
      this.votes.clear();

      clearTimeout(this.endVoteTimeout);
      clearTimeout(this.endMatchTimeout);
      clearInterval(this.intervalMessageTimeout);
    })

    this.server.on(
      `CHAT_COMMAND:${this.options.startVoteCommand.toLowerCase()}`,
      this.onStartVoteCommand
    );
  }
}
