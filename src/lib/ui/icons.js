// The pixelarticons the app uses, inlined so they take currentColor and need no request. Only these are bundled.
import mouse from 'pixelarticons/svg/mouse.svg?raw';
import arrowLeft from 'pixelarticons/svg/arrow-left.svg?raw';
import arrowRight from 'pixelarticons/svg/arrow-right.svg?raw';
import arrowUp from 'pixelarticons/svg/arrow-up.svg?raw';
import arrowDown from 'pixelarticons/svg/arrow-down.svg?raw';
import scrollVertical from 'pixelarticons/svg/scroll-vertical.svg?raw';
import lightbulbOn from 'pixelarticons/svg/lightbulb-on.svg?raw';
import link from 'pixelarticons/svg/link.svg?raw';
import radioSignal from 'pixelarticons/svg/radio-signal.svg?raw';
import repeat from 'pixelarticons/svg/repeat.svg?raw';
import luggage from 'pixelarticons/svg/luggage.svg?raw';
import power from 'pixelarticons/svg/power.svg?raw';
import speedFast from 'pixelarticons/svg/speed-fast.svg?raw';
import batteryCharging from 'pixelarticons/svg/battery-charging.svg?raw';
import bullseyeArrow from 'pixelarticons/svg/bullseye-arrow.svg?raw';
import github from 'pixelarticons/svg/github.svg?raw';
import timeline from 'pixelarticons/svg/timeline.svg?raw';
import sliders from 'pixelarticons/svg/sliders.svg?raw';
import close from 'pixelarticons/svg/close.svg?raw';
import chevronDown from 'pixelarticons/svg/chevron-down.svg?raw';
import chevronRight from 'pixelarticons/svg/chevron-right.svg?raw';
import chevronLeft from 'pixelarticons/svg/chevron-left.svg?raw';
import chevronUp from 'pixelarticons/svg/chevron-up.svg?raw';
import check from 'pixelarticons/svg/check.svg?raw';
import undo from 'pixelarticons/svg/undo.svg?raw';
import edit from 'pixelarticons/svg/edit.svg?raw';
import plus from 'pixelarticons/svg/plus.svg?raw';
import download from 'pixelarticons/svg/download.svg?raw';
import upload from 'pixelarticons/svg/upload.svg?raw';
import sun from 'pixelarticons/svg/sun.svg?raw';
import moon from 'pixelarticons/svg/moon.svg?raw';
import infoBox from 'pixelarticons/svg/info-box.svg?raw';
import shield from 'pixelarticons/svg/shield.svg?raw';
import scriptText from 'pixelarticons/svg/script-text.svg?raw';
import keyboard from 'pixelarticons/svg/keyboard.svg?raw';
import play from 'pixelarticons/svg/play.svg?raw';
import reload from 'pixelarticons/svg/reload.svg?raw';
import alert from 'pixelarticons/svg/alert.svg?raw';
import home from 'pixelarticons/svg/home.svg?raw';
import gamepad from 'pixelarticons/svg/gamepad.svg?raw';
import trophy from 'pixelarticons/svg/trophy.svg?raw';
import tournament from 'pixelarticons/svg/tournament.svg?raw';
import chess from 'pixelarticons/svg/chess.svg?raw';
import dice from 'pixelarticons/svg/dice.svg?raw';
import downasaur from 'pixelarticons/svg/downasaur.svg?raw';
import car from 'pixelarticons/svg/car.svg?raw';
import humanRun from 'pixelarticons/svg/human-run.svg?raw';
import music from 'pixelarticons/svg/music.svg?raw';
import headphone from 'pixelarticons/svg/headphone.svg?raw';
import movie from 'pixelarticons/svg/movie.svg?raw';
import code from 'pixelarticons/svg/code.svg?raw';
import paintBucket from 'pixelarticons/svg/paint-bucket.svg?raw';
import briefcase from 'pixelarticons/svg/briefcase.svg?raw';
import book from 'pixelarticons/svg/book.svg?raw';
import coffee from 'pixelarticons/svg/coffee.svg?raw';
import moonStars from 'pixelarticons/svg/moon-stars.svg?raw';
import heart from 'pixelarticons/svg/heart.svg?raw';
import checkDouble from 'pixelarticons/svg/check-double.svg?raw';
import zap from 'pixelarticons/svg/zap.svg?raw';
import next from 'pixelarticons/svg/next.svg?raw';
import prev from 'pixelarticons/svg/prev.svg?raw';
import volumeX from 'pixelarticons/svg/volume-x.svg?raw';
import volumePlus from 'pixelarticons/svg/volume-plus.svg?raw';
import volumeMinus from 'pixelarticons/svg/volume-minus.svg?raw';
import copy from 'pixelarticons/svg/copy.svg?raw';
import clipboard from 'pixelarticons/svg/clipboard.svg?raw';
import cut from 'pixelarticons/svg/cut.svg?raw';
import layout from 'pixelarticons/svg/layout.svg?raw';
import monitor from 'pixelarticons/svg/monitor.svg?raw';
import image from 'pixelarticons/svg/image.svg?raw';
import lock from 'pixelarticons/svg/lock.svg?raw';
import battery from 'pixelarticons/svg/battery.svg?raw';

const RAW = {
  mouse, 'arrow-left': arrowLeft, 'arrow-right': arrowRight, 'arrow-up': arrowUp, 'arrow-down': arrowDown, 'scroll-vertical': scrollVertical,
  'lightbulb-on': lightbulbOn, link, 'radio-signal': radioSignal, repeat, luggage, power, 'speed-fast': speedFast,
  'battery-charging': batteryCharging, 'bullseye-arrow': bullseyeArrow, github, timeline, sliders, close, 'chevron-down': chevronDown,
  'chevron-right': chevronRight, 'chevron-left': chevronLeft, 'chevron-up': chevronUp, check, undo, edit, plus,
  download, upload, sun, moon, 'info-box': infoBox, shield, 'script-text': scriptText, keyboard, play, reload,
  alert, home, gamepad, trophy, tournament, chess, dice, downasaur, car, 'human-run': humanRun, music, headphone,
  movie, code, 'paint-bucket': paintBucket, briefcase, book, coffee, 'moon-stars': moonStars, heart, 'check-double': checkDouble,
  zap, next, prev, 'volume-x': volumeX, 'volume-plus': volumePlus, 'volume-minus': volumeMinus, copy, clipboard,
  cut, layout, monitor, image, lock, battery,
};

// Some icons set their fill on the root <svg> rather than on each path; the wrapper sets it for all of them.
const inner = s => s.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '').replace(/\s+/g, ' ').trim();
const cache = {};
export const icon = name => (cache[name] ??= RAW[name]
  ? `<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${inner(RAW[name])}</svg>` : '');
