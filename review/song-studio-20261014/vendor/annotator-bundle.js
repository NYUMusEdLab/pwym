(function(modules){const cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}window.Annotator={SongLoader:require("songLoader.js"),Timing:require("timing.js"),Graffiti:require("graffiti.js"),Util:require("util.js"),KeywordDrawings:require("KeywordDrawings.js")};})({"util.js":function(require,module,exports){
var Util = {
    sluggify: function (text) {
        return text.toLowerCase().replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s/g, '-');
    },

    extend: function(child, parent) {
        function Ctor() {
            this.constructor = child;
        }
        Ctor.prototype = parent.prototype;
        var oldProto = child.prototype;
        child.prototype = new Ctor();

        for (var key in oldProto) {
            if (oldProto.hasOwnProperty(key)) {
                child.prototype[key] = oldProto[key];
            }
        }
        child.__super__ = parent.prototype;
        // create reference to parent
        child.super = parent;
    },

    addMethods: function(constructor, methods) {
        var key;

        for (key in methods) {
            constructor.prototype[key] = methods[key];
        }
    },

    randomIntFromInterval: function(min,max) {
        return Math.floor((max - min + 1) * Math.random() + min);
    },

    get: function (url) {
        // Return a new promise.
        return new Promise(function (resolve, reject) {
            // Do the usual XHR stuff
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.timeout = 20000;
            req.ontimeout = function() { reject(new Error('Request timed out')); };

            req.onload = function () {
                // This is called even on 404 etc
                // so check the status
                if (req.status == 200) {
                    // Resolve the promise with the response text
                    resolve(req.response);
                }
                else {
                    // Otherwise reject with the status text
                    // which will hopefully be a meaningful error
                    reject(Error(req.statusText));
                }
            };

            // Handle network errors
            req.onerror = function () {
                reject(Error("Network Error"));
            };

            // Make the request
            req.send();
        });
    },

    smoothscroll: function(element, target, duration) {
      target = Math.round(target);
      duration = Math.round(duration);
      if (duration < 0) {
          return Promise.reject("bad duration");
      }
      if (duration === 0) {
          element.scrollTop = target;
          return Promise.resolve();
      }

      var start_time = Date.now();
      var end_time = start_time + duration;

      var start_top = element.scrollTop;
      var distance = target - start_top;

      // based on http://en.wikipedia.org/wiki/Smoothstep
      var smooth_step = function(start, end, point) {
          if(point <= start) { return 0; }
          if(point >= end) { return 1; }
          var x = (point - start) / (end - start); // interpolation
          return x*x*(3 - 2*x);
      };

      return new Promise(function(resolve, reject) {
          // This is to keep track of where the element's scrollTop is
          // supposed to be, based on what we're doing
          var previous_top = element.scrollTop;

          // This is like a think function from a game loop
          var scroll_frame = function() {
              if(element.scrollTop != previous_top) {
                  reject("interrupted");
                  return;
              }

              // set the scrollTop for this frame
              var now = Date.now();
              var point = smooth_step(start_time, end_time, now);
              var frameTop = Math.round(start_top + (distance * point));
              element.scrollTop = frameTop;

              // check if we're done!
              if(now >= end_time) {
                  resolve();
                  return;
              }

              // If we were supposed to scroll but didn't, then we
              // probably hit the limit, so consider it done; not
              // interrupted.
              if(element.scrollTop === previous_top && element.scrollTop !== frameTop) {
                  resolve();
                  return;
              }
              previous_top = element.scrollTop;

              // schedule next frame for execution
              setTimeout(scroll_frame, 0);
          };

          // boostrap the animation process
          setTimeout(scroll_frame, 0);
      });


    },

    // RGB to Hex conversion
    rgbToHex: function(rgb) {
        var hex = null;

        if (rgb) {
            rgb = rgb.replace(/[^\d,]/g, '').split(',');
            hex = parseInt(rgb[0]).toString(16) + parseInt(rgb[1]).toString(16) + parseInt(rgb[2]).toString(16);
            hex = hex.length == 1 ? "0" + hex : hex;
            hex = ("#" + hex).toUpperCase();
        }

        return hex;
    }
};

module.exports = Util;

},
"songLoader.js":function(require,module,exports){
    var Util = require("util.js");

    var SongLoader = function(options) {
        this.mediaBase = options.assetBase;
        this.songBase  = options.assetBase; // 'songs/'; // use to override .json and .lrc for local debugging
        this.defaultSongsURL = this.songBase + 'default-songset.json';
        this.songSetSlug = options.songSetSlug;
        this.freshContent = null;
        this.currentSong = null;
    };

    SongLoader.prototype = {
        init: function() {
            var self = this;
            var url = this.songSetSlug ? this.songBase + this.songSetSlug + '.json' : this.defaultSongsURL;
            return Util.get(url).then(JSON.parse).then(function(data) {
                if (!data || !Array.isArray(data.songs) || !data.songs.length) {
                    throw new Error('The song catalog is empty or invalid.');
                }
                self.freshContent = data;
            });
        },

        getDefaultSessionSlugForSong: function(songSlug) {
            var selectedSong = this.findSong(songSlug);
            var sessionSlug = null;

            if (selectedSong != null) {
                sessionSlug = selectedSong.defaultSession;
            }

            return sessionSlug;
        },

        findSong: function(songSlug) {
            var selectedSong = null;
            var songs = this.freshContent.songs;

            for (var i = 0; i < songs.length; i++) {
                if (songSlug == songs[i].slug) {
                    selectedSong = songs[i];
                    break;
                }
            }

            if ((selectedSong == null) && (songs.length > 0)) {
                var randomSongIndex = 0; // deterministic fallback for older sessions lacking a song
                selectedSong = songs[randomSongIndex];
                console.log("couldn't find [" + songSlug + "]. loading random song: " + selectedSong.slug);
            }

            return selectedSong;
        },

        findAndLoadSong: function(songSlug) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var selectedSong = self.findSong(songSlug);

                if (selectedSong != null) {
                    self.loadSong(selectedSong.slug).then(
                        function(song) {
                            self.currentSong = selectedSong;
                            resolve(song);
                        },
                        function(error) {
                            reject(Error("couldn't load song [" + selectedSong.slug + '] because ' + error));
                        }
                    );
                }
            });
        },

        /*
         * Utility function for viewing loaded song events (e.g. after LRC processing)
         */
        downloadSongEvents: function(songSlug) {
            this.loadSong(songSlug).then(
                function(songData) {
                    var dataURL = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(songData.events,null,'\t'));
                    var link = window.document.createElement('a');
                    link.href = dataURL;
                    link.download = songData.slug + '_events.json';
                    var click = document.createEvent("Event");
                    click.initEvent("click", true, true);
                    link.dispatchEvent(click);
                }
            )
        },

        _currentJSONVersion : 2,

        _fixupVersion: function(songJSON) {
          if (!songJSON.version || (songJSON.version == 1)) {
              songJSON.version = this._currentJSONVersion;
              songJSON.options = {
                  loadEventsFrom : songJSON.loadEventsFrom, // this got moved
                  isSeparateLyricsBlocks : false // TODO: these versions not ready yet (section timings inaccurate)
              }
          }

          return songJSON;
        },


        loadSong: function(songSlug) {
            var songBase = this.songBase + songSlug + '/' + songSlug;
            var songURL = songBase + '.json';
            var self = this;

            return new Promise(function(resolve, reject) {
                var timeToLoadSong = performance.now();
                Util.get(songURL).then(JSON.parse).then(
                    function(song) {
                        song = self._fixupVersion(song);

                        var loadFrom = song.options.loadEventsFrom;
                        var eventsURL = songBase + loadFrom;

                        if (loadFrom == '.lrc') {
                            Util.get(eventsURL).then(
                                function (lrcData) {
                                    var lines = lrcData.split(/\r\n|\n/);

                                    song.events = self.processLRCLines(lines,song.keywords);
                                    timeToLoadSong = performance.now() - timeToLoadSong;
                                    console.log('loaded song def (' + timeToLoadSong/1000 + ' sec)');
                                    resolve(song);
                                },
                                function (error) {
                                    reject(Error("couldn't load events for [" + eventsURL + '] because ' + error));
                                }
                            );
                        }
                        else if (loadFrom == '_events.json') {
                            Util.get(eventsURL).then(JSON.parse).then(
                                function(eventList) {
                                    song.events = eventList;
                                    resolve(song);
                                },
                                function (error) {
                                    reject(Error("couldn't load events for [" + eventsURL + '] because ' + error));
                                }
                            );
                        }
                        else {
                            reject(Error("unrecognized events type [" + loadFrom + ']'));
                        }
                    },
                    function (error) {
                        reject(Error("couldn't load definition for [" + songURL + '] because ' + error));
                    }
                );
            });
        },

        // break each line into word timings and then stitch back together after looking for keywords
        processLRCLines: function(lines,keywords) {
            var lineToWordsRegExp = /[<\[]\d\d:\d\d\.\d\d\d?[>\]][^<>\[\]]*/g;
            var wordTimingRegExp = /[<\[](\d\d):(\d\d\.\d\d\d?)[>\]](.*)/;
            //var lineToWordsRegExp = /[<\[]\d\d:\d\d\.\d\d[>\]][^<>\[\]]*/g;
            //var wordTimingRegExp = /[<\[](\d\d):(\d\d\.\d\d)[>\]](.*)/;
            var eventList = [];
            var lastEvent = null;
            var lastKeywordEvent = null;

            for (var i = 0; i < lines.length; i++) {
                var rawLine = lines[i];
                var line = '';
                var lineTime = 0;
                var wordMatches = rawLine.match(lineToWordsRegExp);

                if (!wordMatches) {
                    console.log('skipping line ' + (i + 1) + ' [' + rawLine + ']');
                    continue;
                }

                var keywordEvents = [];
                keywords.forEach(function(keyword) {
                    // TODO because rawline contains per-word timing info, multi-word keywords will fail to be matched :(
                    // this currently must be worked around by removing inner-word timing info from the .lrc file
                    var keywordRegExp = new RegExp('\\b' + keyword.term + '\\b'); // require word boundaries

                    if (rawLine.search(keywordRegExp) >= 0) {

                        var keywordEvent = {
                            type   : 'keyword',
                            start  : null,
                            end    : null, // TODO
                            events : [],
                            data   : {
                                term       : keyword.term,
                                definition : keyword.definition,
                                prompts    : keyword.prompts
                            }
                        };

                        keywordEvents.push(keywordEvent);
                    }
                });

                for (var j = 0; j < wordMatches.length; j++) {
                    var wordMatch = wordMatches[j];
                    var wordTimingMatch = wordMatch.match(wordTimingRegExp);

                    if (!wordTimingMatch) {
                        console.log("couldn't parse word timing: " + wordMatch);
                        continue;
                    }
                    var wordTime = (parseInt(wordTimingMatch[1]) * 60) + parseFloat(wordTimingMatch[2]); // minutes plus fractional seconds
                    var word     = wordTimingMatch[3];

                    if (lastKeywordEvent) {
                        lastKeywordEvent.end = wordTime;
                        lastKeywordEvent = null;
                    }

                    keywordEvents.forEach(function(keywordEvent) {
                        if (word.search(keywordEvent.data.term) >= 0) { // may be surrounded by punctuation. TODO: 1) case 2) edge-case false positives if embedded?
                            keywordEvent.start = wordTime;
                            lastKeywordEvent = keywordEvent;
                            return;
                        }
                    });

                    line += word;

                    if (j == 0) {
                        lineTime = wordTime;
                    }
                }

                var lyricEvent = {
                    type   : 'lyric',
                    data   : { text: line },
                    start  : lineTime,
                    end    : null,
                    events : keywordEvents
                };

                if (lastEvent) {
                    lastEvent.end = lineTime;
                }
                eventList.push(lyricEvent);
                lastEvent = lyricEvent;
            }

            if (lastEvent.events.length > 0) {
                let lastSubEvent = lastEvent.events[lastEvent.events.length - 1];
                let lastSubEventEnd = lastSubEvent.start + 0.5; // add half-second
                lastSubEvent.end = lastSubEventEnd;
                lastEvent.end = lastSubEventEnd;
            }

            return eventList;
        }
    };

    Object.defineProperty(SongLoader.prototype,'songs', {
        get : function() {
            return (this.freshContent.songs);
        }
    });

    module.exports = SongLoader;
        
},
"graffiti.js":function(require,module,exports){
var Graffiti = function (width, height, parent) {
    // These are all set by a call to resize()
    this.width;
    this.height;
    this.scale;
    this.xOffset;
    this.yOffset;

    this.drawing = {};
    this.drawing.duration = 0;
    this.drawing.strokes = [];
    this.drawing.version = 2;
    this.drawing.isCompressed = false;

    this.activeStrokes = {};

    this.color = '#000000';
    this.shape = 'circle';
    this.size = 0.5;

    this.playbackMode = 'unison';

    this._canvas = document.createElement('canvas');
    this._context = this._canvas.getContext('2d');
    this.parent = parent;
    parent.appendChild(this._canvas);

    this.resize(width, height);

    this._drawable = false;
    this._startTime = 0;
    this._isDrawing = false;
    this._isDirty = false;

    this._usesPointer = typeof window !== "undefined" && !!window.PointerEvent;
    this._lastTouchTime = 0;
    this.onChange = function() {};
    this._cancelListener = this._cancelInput.bind(this);
    this._canvas.setAttribute("aria-label", "Drawing canvas for the selected keyword");
    this._mousedownListener = this._onPress.bind(this);
    this._mouseupListener = this._onRelease.bind(this);
    this._mousemoveListener = this._onMove.bind(this);

    // Load spray texture
    this._spray = {};
    var img = new Image();
    img.src = 'img/spray_texture.png';
    img.onload = function () {
        this._sprayCanvas = document.createElement('canvas');
        this._sprayCanvas.width = this._sprayCanvas.height = 200;
        var context = this._sprayCanvas.getContext('2d');
        context.drawImage(img, 0, 0);
        this._spray['#FFFFFF'] = this._context.createPattern(this._sprayCanvas, 'repeat');
    }.bind(this);
};

Graffiti.prototype = {
    destroy: function () {
        this.drawable = false;
        this.parent.removeChild(this._canvas);

        delete this._canvas;
        delete this;
    },

    get isDirty() {
        return this._isDirty;
    },

    /**
     * Boolean value for specifying whether or not the canvas is currently
     * in drawing mode or not.
     */
     get drawable() {
         return this._drawable;
     },

     get canvas() {
         return this._canvas;
     },

    set drawable(value) {
        if (this._drawable != value) {
            if (value) {
                this.draw(1);

                this._startTime = Date.now() - this.drawing.duration * 1000;

                this._canvas.style['cursor'] = 'crosshair';

                this._canvas.style.touchAction = 'none';
                this._listenForInput(true);
            } else {
                this._cancelInput();
                this.drawing.duration = (Date.now() - this._startTime) / 1000;
                this._canvas.style.cursor = 'auto';
                this._canvas.style.touchAction = 'auto';
                this._listenForInput(false);
            }

            this._drawable = value;
        }
    },

    toImage: function () {
        var img = new Image();
        img.src = this._canvas.toDataURL();

        return img;
    },

    /**
     *
     */
    draw: function (percentage) {
        this._context.clearRect(0, 0, this.width, this.height);

        if (this.playbackMode == 'unison') {
            for (var i = 0; i < this.drawing.strokes.length; ++i) {
                this._drawStroke(this.drawing.strokes[i], percentage);
            }
        } else if (this.playbackMode == 'timed') {
            var currTime = this.drawing.duration * percentage;

            for (var i = 0; i < this.drawing.strokes.length; ++i) {
                var start = this.drawing.strokes[i].start;
                var duration = this.drawing.strokes[i].duration;

                if (currTime >= start) {
                    if (currTime < start + duration) {
                        var strokePercent = (currTime - start) / duration;

                        this._drawStroke(this.drawing.strokes[i], strokePercent);
                    } else {
                        this._drawStroke(this.drawing.strokes[i], 1);
                    }
                }
            }
        }
    },

    /**
     * Clear the drawing canvas and delete all history.
     */
    clear: function () {
        this._cancelInput();
        this._isDirty = false;
        this.drawing = {};
        this.drawing.duration = 0;
        this.drawing.strokes = [];

        this._context.clearRect(0, 0, this.width, this.height);
    },

    /**
     * Delete the previous stroke.
     */
    undo: function () {
        this._cancelInput();
        this.drawing.strokes.pop(); // TODO: technically this could make us no longer dirty; support?

        this.draw(1);
    },

    /**
     * Resize the drawing canvas
     */
    resize: function (width, height) {
        if (this._isDrawing) this._cancelInput();
        this.width = width;
        this.height = height;
        this.scale = Math.min(width, height);
        this.xOffset = (this.width - this.scale) / 2;
        this.yOffset = (this.height - this.scale) / 2;

        this._canvas.width = this.width;
        this._canvas.height = this.height;

        this.draw(1);
    },

    _drawStroke: function (stroke, percentage) {
        var color = stroke['color'];
        var shape = stroke['shape'];
        var size = (stroke['size'] + 1) * 0.5;

        var fastStroke = false;
        var speedSum = 0;
        var speedCount = 0;

        for (var j = 0; j < stroke['points'].length; ++j) {
            var thisPercent = stroke['points'][j][0];
            var thisPosition = this._scalePoint(stroke['points'][j][1]);
            var thisSpeed = stroke['points'][j][2] || 0;

            if (j == 0) {
                this._context.beginPath();
                this._context.moveTo(thisPosition[0], thisPosition[1]);
            } else {
                var lastPercent = stroke['points'][j - 1][0];
                var lastPosition = this._scalePoint(stroke['points'][j - 1][1]);

                if (percentage == 1 || thisPercent <= percentage) {
                    this._context.lineTo(thisPosition[0], thisPosition[1]);
                } else {
                    var midPercent = (percentage - thisPercent) / (thisPercent - lastPercent);
                    var midPoint = this._lerp(lastPosition, thisPosition, midPercent);

                    this._context.lineTo(midPoint[0], midPoint[1]);
                }

                if (thisPercent >= percentage || (thisSpeed > 0.4 != fastStroke)) {
                    var avgSpeed = speedSum / speedCount;
                    speedSum = speedCount = 0;

                    this._context.strokeStyle = this._sprayPattern(color);
                    this._context.lineWidth = (30 + 5 * avgSpeed) * size;
                    this._context.lineJoin = this._context.lineCap = 'round';
                    this._context.shadowColor = 'rgba(0, 0, 0, 0)';
                    this._context.stroke();

                    this._context.lineWidth = (18 + 12 * avgSpeed) * size;
                    this._context.stroke();

                    this._context.shadowBlur = (20 + 10 * avgSpeed) * size;
                    this._context.shadowColor = color;
                    this._context.strokeStyle = this._sprayColor(color, 0.8 - 0.3 * avgSpeed);
                    this._context.lineWidth = (15 - 3 * avgSpeed) * size;
                    this._context.stroke();

                    this._context.beginPath();
                    this._context.moveTo(thisPosition[0], thisPosition[1]);

                    fastStroke = (thisSpeed > 0.4);

                    if (thisPercent >= percentage) {
                        break;
                    }
                }

                speedSum += thisSpeed;
                speedCount += 1;
            }
        }
    },

    _scalePoint: function (location) {
        var newLocation = [];

        newLocation[0] = (location[0] * this.scale) + this.xOffset;
        newLocation[1] = (location[1] * this.scale) + this.yOffset;

        return newLocation;
    },

    _lerp: function (start, end, percent) {
        var interX = (end[0] - start[0]) * percent + start[0];
        var interY = (end[1] - start[1]) * percent + start[1];

        return [interX, interY];
    },

    _sprayPattern: function (color) {
        if (this._sprayCanvas != undefined) {
            if (this._spray[color] == undefined) {
                var red = parseInt(color.substring(1, 3), 16);
                var green = parseInt(color.substring(3, 5), 16);
                var blue = parseInt(color.substring(5, 7), 16);

                var context = this._sprayCanvas.getContext('2d');
                var imageData = context.getImageData(0, 0, 200, 200);
                for (var i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = red;
                    imageData.data[i + 1] = green;
                    imageData.data[i + 2] = blue;
                }

                context.putImageData(imageData, 0, 0);
                this._spray[color] = this._context.createPattern(this._sprayCanvas, 'repeat');
            }

            return this._spray[color];
        } else {
            return 'transparent';
        }
    },

    _sprayColor: function (color, opacity) {
        var red = parseInt(color.substring(1, 3), 16);
        var green = parseInt(color.substring(3, 5), 16);
        var blue = parseInt(color.substring(5, 7), 16);
        return 'rgba(' + red + ',' + green + ',' + blue + ',' + opacity + ')';
    },

    _listenForInput: function(enabled) {
        var method = enabled ? 'addEventListener' : 'removeEventListener';
        var events = this._usesPointer ? {
            pointerdown: this._mousedownListener, pointermove: this._mousemoveListener,
            pointerup: this._mouseupListener, pointercancel: this._cancelListener,
            lostpointercapture: this._cancelListener
        } : {
            mousedown: this._mousedownListener, mousemove: this._mousemoveListener,
            mouseup: this._mouseupListener, mouseout: this._mouseupListener,
            touchstart: this._mousedownListener, touchmove: this._mousemoveListener,
            touchend: this._mouseupListener, touchcancel: this._cancelListener
        };
        Object.keys(events).forEach(function(type) {
            this._canvas[method](type, events[type], {passive: false});
        }.bind(this));
        window[method]('blur', this._cancelListener);
    },

    _inputPoint: function(evt) {
        var point = evt, id = 'mouse';
        if (evt.type.indexOf('touch') === 0) {
            this._lastTouchTime = Date.now();
            var touches = Array.prototype.slice.call(evt.changedTouches || []);
            point = this._isDrawing ? touches.find(function(t) {
                return ('touch-' + t.identifier) in this.activeStrokes;
            }.bind(this)) : touches[0];
            if (!point) return null;
            id = 'touch-' + point.identifier;
        } else if (evt.type.indexOf('pointer') === 0) {
            id = 'pointer-' + evt.pointerId;
        } else if (Date.now() - this._lastTouchTime < 700) {
            return null; // Ignore compatibility mouse events after legacy touch input.
        }
        var rect = this._canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || !this.scale) return null;
        return {screenX: (point.clientX - rect.left) * this.width / rect.width,
                screenY: (point.clientY - rect.top) * this.height / rect.height,
                strokeId: id};
    },

    _onPress: function(evt) {
        if (!this._drawable || this._isDrawing || evt.isPrimary === false ||
            (evt.button !== undefined && evt.button !== 0)) return;
        var point = this._inputPoint(evt);
        if (!point) return;
        if (evt.cancelable) evt.preventDefault();
        var stroke = {start: (Date.now() - this._startTime) / 1000,
            color: this.color, shape: this.shape, size: this.size, duration: 0,
            points: [[0, [(point.screenX - this.xOffset) / this.scale,
                           (point.screenY - this.yOffset) / this.scale], 0]]};
        this.drawing.strokes.push(stroke);
        this.activeStrokes[point.strokeId] = stroke;
        this._isDrawing = true;
        this._isDirty = true;
        if (evt.pointerId !== undefined && this._canvas.setPointerCapture) {
            this._pointerId = evt.pointerId;
            try { this._canvas.setPointerCapture(evt.pointerId); } catch (ignore) {}
        }
    },

    _onMove: function(evt) {
        if (!this._isDrawing) return;
        var point = this._inputPoint(evt);
        if (!point || !this.activeStrokes[point.strokeId]) return;
        if (evt.cancelable) evt.preventDefault();
        this._updateStroke(point);
        this.draw(1);
    },

    _onRelease: function(evt) {
        if (!this._isDrawing) return;
        var point = this._inputPoint(evt);
        if (!point || !this.activeStrokes[point.strokeId]) return;
        if (evt.cancelable) evt.preventDefault();
        this._updateStroke(point);
        this._cancelInput();
    },

    _cancelInput: function(evt) {
        if (!this._isDrawing) return;
        if (evt && evt.pointerId !== undefined && evt.pointerId !== this._pointerId) return;
        if (evt && evt.type === 'touchcancel' && evt.changedTouches.length && !this._inputPoint(evt)) return;
        this._isDrawing = false;
        this.activeStrokes = {};
        var pointerId = this._pointerId;
        this._pointerId = undefined;
        if (pointerId !== undefined && this._canvas.releasePointerCapture) {
            try { this._canvas.releasePointerCapture(pointerId); } catch (ignore) {}
        }
        this.drawing.duration = Math.max(this.drawing.duration, (Date.now() - this._startTime) / 1000);
        this.draw(1);
        this.onChange(); // Preserve completed/cancelled strokes and mark the session dirty.
    },

    _updateStroke: function (update) {
        var x = (update.screenX - this.xOffset) / this.scale;
        var y = (update.screenY - this.yOffset) / this.scale;
        var currStroke = this.activeStrokes[update.strokeId];

        if (!currStroke) return;

        var currTime = (Date.now() - this._startTime) / 1000 - currStroke.start;
        var lastPoint = currStroke['points'][currStroke['points'].length - 1];
        var distance = Math.sqrt(Math.pow(x - lastPoint[1][0], 2) + Math.pow(y - lastPoint[1][1], 2));
        var delay = Math.max(0.001, currTime - currStroke.duration);
        var speed = Math.min(15, distance / delay + 1) / 15;
        var percentDurationChange = (currTime > 0) ? currStroke.duration / currTime : 0;

        // First, update the percentages of all previous points
        for (var j = 0; j < currStroke.points.length; ++j) {
            currStroke.points[j][0] *= percentDurationChange;
        }

        currStroke.points.push([1, [x, y], speed]);

        currStroke.duration = currTime;
    }
};

Graffiti.compressDrawing = function(drawing) {
    if(drawing.isCompressed) {
        return drawing; // nothing to do
    }

    var copy = {};
    copy.duration = drawing.duration;
    copy.version = 2;
    copy.isCompressed = true;
    copy.strokes = [];
    
    for(var i = 0; i < drawing.strokes.length; ++i) {
        var oldStroke = drawing.strokes[i];
        
        var stroke = {};
        stroke.color = oldStroke.color;
        stroke.duration = oldStroke.duration;
        stroke.shape = oldStroke.shape;
        stroke.size = oldStroke.size;
        stroke.start = oldStroke.start;
        
        var serializedPoints = [];
        
        for(var j = 0; j < oldStroke.points.length; ++j) {
            var oldPoint = oldStroke.points[j];
            
            serializedPoints.push(oldPoint[0]);
            serializedPoints.push(oldPoint[1][0]);
            serializedPoints.push(oldPoint[1][1]);
            serializedPoints.push(oldPoint[2]);
        }
        
        stroke.points = btoa(String.fromCharCode.apply(null, new Uint8Array(new Float32Array(serializedPoints).buffer)));
        
        copy.strokes.push(stroke);
    }
    
    return copy;
};

Graffiti.decompressDrawing = function(drawing) {
    if(drawing.version == undefined || drawing.version < 2 || !drawing.isCompressed) {
        return drawing; // nothing to do
    }

    for(var i = 0; i < drawing.strokes.length; ++i) {
        var currStroke = drawing.strokes[i];

        var serializedPoints = new Float32Array(new Uint8Array(Array.from(atob(currStroke.points)).map(function(ch) { return ch.charCodeAt() })).buffer);
        var points = [];

        for(var j = 0; j < serializedPoints.length; j += 4) {
            points.push([serializedPoints[j], [serializedPoints[j + 1], serializedPoints[j + 2]], serializedPoints[j + 3]]);
        }

        currStroke.points = points;
    }

    drawing.isCompressed = false;
    
    return drawing;
};

window.graffiti = Graffiti;

module.exports = Graffiti;
},
"KeywordDrawings.js":function(require,module,exports){
var Util = require("util.js");
var own = Object.prototype.hasOwnProperty;

// Timing IDs are assigned at load time. A word and its song position survive reload/copy.
function key(event) {
    return Util.sluggify(event.data.term) + '@' + Number(event.start).toFixed(3);
}
function clone(value) {
    if (!value || typeof value !== 'object') return value;
    var copy = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function(k) { copy[k] = clone(value[k]); });
    return copy;
}
function resolve(app, event) {
    var slug = Util.sluggify(event.data.term);
    var id = key(event);
    var custom = own.call(app.drawingOverrides || {}, id);
    var override = custom ? app.drawingOverrides[id] : null;
    return {key: id, keyword: slug, isCustom: custom,
        drawing: custom ? override.drawing : app.drawings[slug],
        background: (custom ? override.background : app.backgrounds[slug]) || app.defaultBackgroundColor};
}
function matching(app, event) {
    var slug = Util.sluggify(event.data.term);
    return app.timing._allEvents.filter(function(candidate) {
        return candidate.type === 'keyword' && Util.sluggify(candidate.data.term) === slug;
    });
}
module.exports = {key: key, clone: clone, resolve: resolve, matching: matching};

},
"timing.js":function(require,module,exports){
    /**
     * Object for doing event sequencing.
     */
    var Timing = function () {
        /**
         * Callback function for every animation frame in the timing library
         */
        this.onProgress = function () {
        };

        // Event list: structured identically to our score JSON files
        this._eventList = {};

        // Flattened event list: for lookup by index
        this._allEvents = new Array();

        // Array of events that are currently active
        this._currEvents = {};

        // The numeric id that will be attached to the next event. Doubles as a total
        // count of all events currently in the event list (irrespective of hierarchy)
        this._currentId = 0;

        // All registered callback functions. Keys are event types, values are objects
        // of the form {'onStart': myFunction, etc.}
        this._callbacks = {};

        // The media object that will be synchronized with the playback.
        this._mediaSync;

        // Whether the timing system is currently playing.
        this._isPlaying = false;
    };

    Timing.prototype = {
        /**
         * Load events into the timing library event list from a JSON file.
         * @param  {String}   url      Path to the JSON file that you're trying to load.
         * @param  {Function} callback Callback function for when the events are loaded. The event list is passed as a parameter to the callback.
         */
        loadEvents: function (url, callback) {
            var xmlhttp = new XMLHttpRequest();

            // Wait for progress on the request
            xmlhttp.onreadystatechange = function (evt) {
                // Check if the request has gone through
                if (evt.target.readyState == 4 && evt.target.status == 200) {
                    // Parse the JSON
                    var eventList = JSON.parse(evt.target.responseText);

                    this.addEvents(eventList);

                    // Fire callback
                    if (callback) {
                        callback(eventList);
                    }
                }
            }.bind(this);

            xmlhttp.open("GET", url, true);
            xmlhttp.send();
        },

        /**
         * Play the timeline from the beginning, or from the point where the timeline
         * was last paused.
         */
        play: function () {
            if (this._isPlaying)
                return; // short-circuit

            this._mediaSync.play();

            this._isPlaying = true;

            // Start up the requestAnimationFrame loop
            this._updateTiming();
        },

        /**
         * Pause the main timeline.
         */
        pause: function () {
            if (!this._isPlaying)
                return; // short-circuit

            this._isPlaying = false;
            this._mediaSync.pause();

            // // Fire ending events for all
            // for (var index in this._currEvents) {
            //     this._endEvent(this._currEvents[index]);
            // }
            // 
            // // Clear our our current events list
            // this._currEvents = [];
        },

        /**
         * Stop/Reset the main timeline.
         */
        stop: function() {
            if (!this._isPlaying && this.currentTime === 0)
                return; // short-circuit

            this._isPlaying = false;
            this._mediaSync.pause();

            // // Fire ending events for all
            // for (var index in this._currEvents) {
            //     this._endEvent(this._currEvents[index]);
            // }
            // 
            // // Clear our our current events list
            // this._currEvents = [];

            // Reset current time
            this.currentTime = 0;
            console.log('it stopped');
        },

        /**
         * [function description]
         * @param  {String} type         The name of the type of event to attach these callbacks to.
         * @param  {Function} onStart    Callback function for event start. Receives the event object as a parameter.
         * @param  {Function} onEnd      Callback function for event end. Receives the event object as a parameter.
         * @param  {Function} onProgress Callback function for each animation frame during an event. Receives the event object,
         *                               and a progress percentage (from 0 to 1) as parameters.
         */
        setEventCallback: function (type, onStart, onEnd, onProgress) {
            // Attach an empty object to the callbacks of this type.
            this._callbacks[type] = {};

            if (onStart) {
                this._callbacks[type]['onStart'] = onStart;
            }

            if (onEnd) {
                this._callbacks[type]['onEnd'] = onEnd;
            }

            if (onProgress) {
                this._callbacks[type]['onProgress'] = onProgress;
            }
        },

        /**
         * Specify a media object whose playback will be synchronized to the timeline.
         * @param  {Object} mediaObject Reference to either an audio or video tag that syncs with
         *                              the timeline.
         */
        attachMedia: function (mediaObject) {
            this._mediaSync = mediaObject;
            var self = this;

            // TODO: add callback for this or other loading events?
            this._mediaSync.addEventListener('loadedmetadata', function (event) {
                console.log('media loaded: duration=' + self.duration);
            });
        },

        setMediaSource: function (src) {
            this._mediaSync.src = src;
        },

        setMediaVolume: function (volume) {
            this._mediaSync.volume = volume;
        },

        getMediaSource: function () {
            return this._mediaSync.src;
        },


        /**
         * Get a reference to the event with the specified ID number.
         * @param  {Number} id The ID number of the requested event.
         * @return {Object}    The relevant event object.
         */
        getEventById: function (id) {
            return this._allEvents[id];
        },

        addEvents: function(eventList, track) {
            for (var i = 0; i < eventList.length; i++) {
                var event = eventList[i];

                if(!this._eventList[track]) {
                    this._eventList[track] = new Array();
                }

                this._eventList[track].push(event);
                this._setEventId(event);
            }
        },


        addEventNow: function(type, duration, data, track) {
            var newEvent = {};

            newEvent.type = type;
            newEvent.start = this.currentTime;
            newEvent.end = this.currentTime + duration;
            newEvent.data = data;
            newEvent.events = [];

            if(!this._eventList[track]) {
                this._eventList[track] = new Array();
            }

            this._eventList[track].push(newEvent);
            this._setEventId(newEvent);
        },

        clearTrack: function(track) {
            if(this._eventList[track]) {
                for(var i = 0; i < this._eventList[track].length; ++i) {
                    // TODO: Delete all the individual events from everything
                }

                this._eventList[track] = new Array();
            }
        },

        _setEventId: function (event) {
            event['id'] = this._currentId;
            this._currentId += 1;

            this._allEvents.push(event);

            for (var index in event['events']) {
                this._setEventId(event['events'][index]);
            }
        },
        
        /**
         * Called every animation frame to check in on the state of the events.
         * @private
         */
        _updateTiming: function () {
            if (this._mediaSync.paused) {
                this.pause();
            } else {
                this.onProgress();
                this._updateEvents();

                window.requestAnimationFrame(this._updateTiming.bind(this));
            }
        },
        
        _updateEvents: function () {
            // First, remove all events that are over
            for (var index in this._currEvents) {
                if (this._currEvents[index]['start'] > this.currentTime || this._currEvents[index]['end'] <= this.currentTime) {
                    // End any events whose time has passed
                    this._endEvent(this._currEvents[index]);
                }
            }
            
            // Now, start any new top-level events
            for (var trackKey in this._eventList) {
                let track = this._eventList[trackKey];

                // Now, look through all of the events and figure out which new events need to be fired
                for (var index = 0; index < track.length; ++index) {
                    let event = track[index];

                    if (event['start'] <= this.currentTime && this.currentTime < event['end']) {
                        this._startEvent(event); // (will check if the event has already been started)
                    }
                }
            }
            
            // Now, for all the events that are still active (or newly active), update their progress
            for (var index in this._currEvents) {
                this._progressEvent(this._currEvents[index]);
            }
        },

        _startEvent: function (event) {
            if(this._currEvents[event.id] == undefined) {
                if (this._callbacks[event.type] && this._callbacks[event.type].onStart) {
                    this._callbacks[event.type].onStart(event);
                }

                this._currEvents[event.id] = event;
                
                return true;
            } else {
                return false;
            }
        },

        _endEvent: function (event) {
            if (this._callbacks[event['type']] && this._callbacks[event['type']].onEnd) {
                this._callbacks[event['type']].onEnd(event);
            }

            delete this._currEvents[event['id']];
        },

        _progressEvent: function (event) {
            if (this._callbacks[event['type']] && this._callbacks[event['type']].onProgress) {
                var progress = (this.currentTime - event['start']) / (event['end'] - event['start']);

                this._callbacks[event['type']].onProgress(event, progress);
            }
            
            for (var subIndex in event['events']) {
                var subevent = event['events'][subIndex];

                if (subevent['start'] <= this.currentTime && subevent['end'] > this.currentTime) {
                    var newlyAdded = this._startEvent(subevent);
                    
                    if(newlyAdded) {
                        this._progressEvent(subevent);
                    }
                }
            }
        }
    };

    Object.defineProperty(Timing.prototype, 'currentTime', {
        get: function () {
            return this._mediaSync.currentTime;
        },
        set: function (value) {
            if (value == this._mediaSync.currentTime) {
                return; // short-circuit
            }

            this._mediaSync.currentTime = value;
            this.onProgress();
            this._updateEvents();
        }
    });

    Object.defineProperty(Timing.prototype, 'duration', {
        get: function () {
            return this._mediaSync.duration;
        }
    });

    Object.defineProperty(Timing.prototype, 'paused', {
        get: function () {
            return this._mediaSync.paused;
        }
    });

    module.exports = Timing;

}});
