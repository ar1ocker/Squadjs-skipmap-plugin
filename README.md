# SquadJS Skipmap Plugin
SquadJS plugin for voting for skip map

SquadJS плагин для пропуска карты в Squad

Проверено на версии 3.7.0

## Установка

1. Копируем файл в папку squad-server/plugins/
2. Правим config.json, дописывая в раздел `plugins`

2.1. Минимальная конфигурация
```
{
  "plugin": "SkipMapVote",
  "enabled": true
},
```

2.2. Максимальная конфигурация
```
{
  "plugin": "SkipMapVote",
  "enabled": true,
  "startVoteCommand": "skipmap",
  "startVoteMessage": "Голосование за скип карты! + или - в чат"
  "ignoreChats": ["ChatTeam", "ChatSquad"],
  "endVoteTimer": 120,
  "activeTimeAfterNewMap": 180,
  "minPlayersForStart": 10,
  "minPlayersVotePercent": 0.30,
  "timeoutBeforeEndMatch": 7,
  "periodicallyMessageTimer": 15,
  "periodicallyMessageText": "Скип? +/-"
},
```

## Описание параметров

**startVoteCommand**
  description: 'Команда начала голосования',
  default: 'skipmap'
  
**startVoteMessage**
  
  description: 'Сообщение после начала голосования',
  
  default: 'Голосование за скип карты! + или - в чат'

**ignoreChats**

  description: 'Пропускаемые чаты',

  default: ['ChatTeam', 'ChatSquad']

**endVoteTimer**
  
  description: 'Время на голосование в секундах',
  
  default: 120

**activeTimeAfterNewMap**
  
  description: 'Время после начала новой карты в которое доступен скип карты в секундах',
  
  default: 180

**minPlayersForStart**
  
  description: 'Минимальное количество игроков после которого активен скип карты',
  
  default: 10

**minPlayersVotePercent**
  
  description: 'Минимальный процент проголосовавших для зачета результата, дробное значение',
  
  default: 0.30

**timeoutBeforeEndMatch**
  
  description: 'Таймаут перед завершением матча в секундах',
  
  default: 7

**periodicallyMessageTimer**
  
  description: 'Время между сообщениями о ходе голосования, в секундах',
  
  default: 15

**periodicallyMessageText**
  
  description: 'Текст периодического сообщения',
  
  default: 'Скип? +/-'
