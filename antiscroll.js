(function ($) {

  /**
   * Augment jQuery prototype.
   */

  $.fn.antiscroll = function (options) {
    return this.each(function () {
      var antiscroll = $(this).data('antiscroll');
      if (antiscroll) {
        antiscroll.inner.attr('style', '');
        antiscroll.destroy();
      }
      
      if (options === 'destroy') {
        return;
      }

      $(this).data('antiscroll', new $.Antiscroll(this, options));
    });
  };

  /**
   * Expose constructor and Scrollbar constructor.
   */

  $.Antiscroll = Antiscroll;
  Antiscroll.Scrollbar = Scrollbar;

  /**
   * Antiscroll pane constructor.
   *
   * @param {Element|jQuery} main pane
   * @parma {Object} options
   * @api public
   *
   * Supported options:
   *
   *   - autoHide           {boolean}  (default: true) auto-hide the scrollbars when mouse moves outside area
   *   - initialDisplay     {number/boolean}   (default: 3000) number of milliseconds for the initial display period when the scrollbar is created. Set to boolean `false` to display the initial display period entirely.
   *   - x                  {boolean}  (default: null) set the horizontal scrollbar visibility:
   *     + `true`:               always *show* the scroll bar, i.e. *force* the scrollbar
   *     + `false`:              always *hide* the scroll bar, i.e. *disable* the scrollbar
   *     + `null` / `undefined`: let the system decide, based on the DOM measurements, i.e. set to the scrollbar to *automatic*
   *   - y                  {boolean}  (default: null) set the vertical scrollbar visibility:
   *     + `true`:               always *show* the scroll bar, i.e. *force* the scrollbar
   *     + `false`:              always *hide* the scroll bar, i.e. *disable* the scrollbar
   *     + `null` / `undefined`: let the system decide, based on the DOM measurements, i.e. set to the scrollbar to *automatic*
   *   - padding            {number}   (default: 2) the scrollbar track padding
   */

  function Antiscroll(el, opts) {
    this.el = $(el);
    this.options = opts || {};

    this.x = this.options.x;
    this.y = this.options.y;
    this.autoHide = false !== this.options.autoHide;
    this.padding = (undefined == this.options.padding ? 2 : this.options.padding);          // jshint ignore:line

    // Select only semi-direct children: it allows nesting antiscroll contexts
    // as long as you initialize Antiscroll contexts from inner towards outer DOM.
    this.inner = this.el.find('.antiscroll-inner').filter(':not(.antiscroll-instance)').filter(':first');
    this.inner.css({
        'width':  '+=' + (this.y !== false ? scrollbarSize() : 0),
        'height': '+=' + (this.x !== false ? scrollbarSize() : 0)
    })
    .addClass('antiscroll-instance');

    this.refresh();
  }

  /**
   * refresh scrollbars
   *
   * @api public
   */

  Antiscroll.prototype.refresh = function () {
    var needHScroll = (this.options.x != null ?                                             // jshint ignore:line
                        this.options.x :
                        (this.inner.length > 0 ? this.inner.get(0).scrollWidth : 0) > this.el.width() + scrollbarSize()
                      ),
        needVScroll = (this.options.y != null ?                                             // jshint ignore:line
                        this.options.y :
                        (this.inner.length > 0 ? this.inner.get(0).scrollHeight : 0) > this.el.height() + scrollbarSize()
                      );

    if (!this.horizontal && needHScroll) {
      this.horizontal = new Antiscroll.Scrollbar.Horizontal(this);
    } else if (this.horizontal && !needHScroll)  {
      this.horizontal.destroy();
      this.horizontal = null;
    } else if (this.horizontal) {
      this.horizontal.update();
    }

    if (!this.vertical && needVScroll) {
      this.vertical = new Antiscroll.Scrollbar.Vertical(this);
    } else if (this.vertical && !needVScroll)  {
      this.vertical.destroy();
      this.vertical = null;
    } else if (this.vertical) {
      this.vertical.update();
    }
  };

  /**
   * Cleans up.
   *
   * @return {Antiscroll} for chaining
   * @api public
   */

  Antiscroll.prototype.destroy = function () {
    this.inner
    .css({
        'width':  '',
        'height': ''
    })
    .removeClass('antiscroll-instance');

    if (this.horizontal) {
      this.horizontal.destroy();
      this.horizontal = null;
    }
    if (this.vertical) {
      this.vertical.destroy();
      this.vertical = null;
    }
    return this;
  };

  /**
   * Rebuild Antiscroll.
   * Optionally specify a new set of options.
   *
   * @return {Antiscroll} for chaining
   * @api public
   */

  Antiscroll.prototype.rebuild = function (newOptions) {
    this.destroy();
    Antiscroll.call(this, this.el, newOptions || this.options);
    return this;
  };

  /**
   * Scrollbar constructor.
   *
   * @param {Element|jQuery} element
   * @api public
   */

  function Scrollbar(pane) {
    this.pane = pane;
    this.pane.el.append(this.el);
    this.innerEl = this.pane.inner.get(0);

    this.dragging = false;
    this.enter = false;
    this.shown = false;

    // hovering
    this.pane.el.mouseenter($.proxy(this, 'mouseenter'));
    this.pane.el.mouseleave($.proxy(this, 'mouseleave'));

    // dragging
    this.el.mousedown($.proxy(this, 'mousedown'));

    // scrolling
    this.innerPaneScrollListener = $.proxy(this, 'scroll');
    this.pane.inner.scroll(this.innerPaneScrollListener);

    // wheel -optional-
    this.innerPaneMouseWheelListener = $.proxy(this, 'mousewheel');
    this.pane.inner.bind('mousewheel', this.innerPaneMouseWheelListener);

    // show
    var initialDisplay = this.pane.options.initialDisplay;

    if (initialDisplay !== false) {
      this.show();
      if (this.pane.autoHide) {
          this.hiding = setTimeout($.proxy(this, 'hide'), parseInt(initialDisplay, 10) || 3000);
      }
    }
  }

  /**
   * Cleans up.
   *
   * @return {Scrollbar} for chaining
   * @api public
   */

  Scrollbar.prototype.destroy = function () {
    this.el.remove();
    this.el.unbind('mousedown', this.mousedown);
    this.pane.el.unbind('mouseenter', this.mouseenter);
    this.pane.el.unbind('mouseleave', this.mouseleave);
    this.pane.inner.unbind('scroll', this.innerPaneScrollListener);
    this.pane.inner.unbind('mousewheel', this.innerPaneMouseWheelListener);
    return this;
  };

  /**
   * Called upon mouseenter.
   *
   * @api private
   */

  Scrollbar.prototype.mouseenter = function () {
    this.enter = true;
    this.show();
  };

  /**
   * Called upon mouseleave.
   *
   * @api private
   */

  Scrollbar.prototype.mouseleave = function () {
    this.enter = false;

    if (!this.dragging) {
        if (this.pane.autoHide) {
            this.hide();
        }
    }
  };

  /**
   * Called upon wrap scroll.
   *
   * @api private
   */

  Scrollbar.prototype.scroll = function () {
    if (!this.shown) {
      this.show();
      if (!this.enter && !this.dragging) {
        if (this.pane.autoHide) {
            this.hiding = setTimeout($.proxy(this, 'hide'), 1500);
        }
      }
    }

    this.update();
  };

  /**
   * Called upon scrollbar mousedown.
   *
   * @api private
   */

  Scrollbar.prototype.mousedown = function (ev) {
    ev.preventDefault();

    this.dragging = true;

    this.startPageY = ev.pageY - parseInt(this.el.css('top'), 10);
    this.startPageX = ev.pageX - parseInt(this.el.css('left'), 10);

    // prevent crazy selections on IE
    this.el[0].ownerDocument.onselectstart = function () { 
      return false; 
    };

    var pane = this.pane,
        move = $.proxy(this, 'mousemove'),
        self = this;

    $(this.el[0].ownerDocument)
      .mousemove(move)
      .mouseup(function () {
        self.dragging = false;
        this.onselectstart = null;

        $(this).unbind('mousemove', move);

        if (!self.enter) {
          self.hide();
        }
      });
  };

  /**
   * Show scrollbar.
   *
   * @api private
   */

  Scrollbar.prototype.show = function (duration) {
    if (!this.shown && this.update()) {
      this.el.addClass('antiscroll-scrollbar-shown');
      if (this.hiding) {
        clearTimeout(this.hiding);
        this.hiding = null;
      }
      this.shown = true;
    }
  };

  /**
   * Hide scrollbar.
   *
   * @api private
   */

  Scrollbar.prototype.hide = function () {
    if (this.pane.autoHide !== false && this.shown) {
      // check for dragging
      this.el.removeClass('antiscroll-scrollbar-shown');
      this.shown = false;
    }
  };

  /**
   * Horizontal scrollbar constructor
   *
   * @api private
   */

  Scrollbar.Horizontal = function (pane) {
    this.el = $('<div class="antiscroll-scrollbar antiscroll-scrollbar-horizontal"/>', pane.el);
    Scrollbar.call(this, pane);
  };

  /**
   * Inherits from Scrollbar.
   */

  inherits(Scrollbar.Horizontal, Scrollbar);

  /**
   * Updates size/position of scrollbar.
   *
   * @api private
   */

  Scrollbar.Horizontal.prototype.update = function () {
    var paneWidth = this.pane.el.width(), 
        trackWidth = paneWidth - this.pane.padding * 2,
        innerEl = this.pane.inner.get(0);

    this.el
      .css('width', trackWidth * paneWidth / innerEl.scrollWidth)
      .css('left', trackWidth * innerEl.scrollLeft / innerEl.scrollWidth);

    return paneWidth < innerEl.scrollWidth;
  };

  /**
   * Called upon drag.
   *
   * @api private
   */

  Scrollbar.Horizontal.prototype.mousemove = function (ev) {
    var trackWidth = this.pane.el.width() - this.pane.padding * 2, 
      pos = ev.pageX - this.startPageX,
      barWidth = this.el.width(),
      innerEl = this.pane.inner.get(0);

    // minimum top is 0, maximum is the track height
    var y = Math.min(Math.max(pos, 0), trackWidth - barWidth);

    innerEl.scrollLeft = (innerEl.scrollWidth - this.pane.el.width()) * y / (trackWidth - barWidth);
  };

  /**
   * Called upon container mousewheel.
   *
   * @api private
   */

  Scrollbar.Horizontal.prototype.mousewheel = function (ev, delta, x, y) {
    if ((x < 0 && 0 === this.pane.inner.get(0).scrollLeft) ||
        (x > 0 && (this.innerEl.scrollLeft + Math.ceil(this.pane.el.width()) === this.innerEl.scrollWidth))) {
      ev.preventDefault();
      return false;
    }
  };

  /**
   * Vertical scrollbar constructor
   *
   * @api private
   */

  Scrollbar.Vertical = function (pane) {
    this.el = $('<div class="antiscroll-scrollbar antiscroll-scrollbar-vertical"/>', pane.el);
    Scrollbar.call(this, pane);
  };

  /**
   * Inherits from Scrollbar.
   */

  inherits(Scrollbar.Vertical, Scrollbar);

  /**
   * Updates size/position of scrollbar.
   *
   * @api private
   */

  Scrollbar.Vertical.prototype.update = function () {
    var paneHeight = this.pane.el.height(), 
        trackHeight = paneHeight - this.pane.padding * 2,
        innerEl = this.innerEl;
      
    var scrollbarHeight = trackHeight * paneHeight / innerEl.scrollHeight;
    scrollbarHeight = scrollbarHeight < 20 ? 20 : scrollbarHeight;
    
    var topPos = trackHeight * innerEl.scrollTop / innerEl.scrollHeight;
    
    if ((topPos + scrollbarHeight) > trackHeight) {
        var diff = (topPos + scrollbarHeight) - trackHeight;
        topPos = topPos - diff - 3;
    }

    this.el
      .css('height', scrollbarHeight)
      .css('top', topPos);
    
    return paneHeight < innerEl.scrollHeight;
  };

  /**
   * Called upon drag.
   *
   * @api private
   */

  Scrollbar.Vertical.prototype.mousemove = function (ev) {
    var paneHeight = this.pane.el.height(),
        trackHeight = paneHeight - this.pane.padding * 2,
        pos = ev.pageY - this.startPageY,
        barHeight = this.el.height(),
        innerEl = this.innerEl;

    // minimum top is 0, maximum is the track height
    var y = Math.min(Math.max(pos, 0), trackHeight - barHeight);

    innerEl.scrollTop = (innerEl.scrollHeight - paneHeight) * y / (trackHeight - barHeight);
  };

  /**
   * Called upon container mousewheel.
   *
   * @api private
   */

  Scrollbar.Vertical.prototype.mousewheel = function (ev, delta, x, y) {
    if ((y > 0 && 0 === this.innerEl.scrollTop) ||
        (y < 0 && (this.innerEl.scrollTop + Math.ceil(this.pane.el.height()) === this.innerEl.scrollHeight))) {
      ev.preventDefault();
      return false;
    }
  };

  /**
   * Cross-browser inheritance.
   *
   * @param {Function} constructor
   * @param {Function} constructor we inherit from
   * @api private
   */

  function inherits(ctorA, ctorB) {
    function f() {}
    f.prototype = ctorB.prototype;
    ctorA.prototype = new f();
  }

  /**
   * Scrollbar size detection.
   */

  var size;

  function scrollbarSize() {
    if (size === undefined) {
      var $div = $('<div class="antiscroll-inner"></div>');
      var $innerDiv = $('<div />');
      $div.css({
        width: '50px',
        height: '50px',
        overflowY: 'scroll',
        position: 'absolute',
        top: '-200px',
        left: '-200px',
      });
      $innerDiv.css({
        height: '100px',
        width: '100%'
      });
      $div.append($innerDiv);

      $('body').append($div);
      var w1 = $div.innerWidth();
      var w2 = $('div', $div).innerWidth();
      $div.remove();

      size = w1 - w2;
    }

    return size;
  }

})(jQuery);
