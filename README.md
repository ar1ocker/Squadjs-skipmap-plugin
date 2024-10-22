# ⭐ If it's useful, give it a star ⭐
# SquadJS Skipmap Plugin

## English

SquadJS plugin for voting for skip map

**Tested on SquadJS 4.1.0**

To add a language or change an existing one, change the localization files in `skipmap-locales` folder

### Settings

0. Install `y18n`

```
npm install y18n
```

1. Copy the `skipmap.js` plugin and `skipmap-locales` folder to the `squad-server/plugins/` folder
2. Edit config.json by adding it to the `plugins` section

2.1. Minimum configuration
```
{
  "plugin": "SkipMapVote",
  "enabled": true,
  "language": "en"
},
```

The rest of the parameters are described in the plugin

## Russian

SquadJS плагин для пропуска карты в Squad

Проверено на версии SquadJS 4.1.0

Чтобы добавить язык или изменить существующий, измените файлы локализации в папке "skipmap-locales"

### Установка

0. Устанавливаем `y18n`

```
npm install y18n
```

1. Копируем файл в папку squad-server/plugins/
2. Правим config.json, дописывая в раздел `plugins`

2.1. Минимальная конфигурация
```
{
  "plugin": "SkipMapVote",
  "enabled": true,
  "language": "ru"
},
```

Остальные параметры описаны в плагине
