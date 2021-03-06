/**
 * Event
 */

 /* 
RR.eventCache = {
	'event_1': {
		'uid_1': [
			fn1: 1,
			fn2: 1,
			...
		[,
		'uid_2': [
			fn1: 1,
			fn2: 1,
			...
		[,
		
	},
	'event_2': {
		'uid_1':[
			fn1: 1,
			fn2: 1,
			...
		[,
		...
	},
	...
};
*/

RR.event = function(e) {
	if (e instanceof RR.event) {
		return e;
	}

	var changedTouches = e.changedTouches, 
		ee = (changedTouches && changedTouches.length > 0) ? changedTouches[0] : e;

	this.originalEvent = ee;
	this.target = e.target || e.srcElement;
	this.type = e.type;
	return this;
};

RR.event.prototype = {

	isPropagationStopped: false,
	
	preventDefault: function() {
		var e = this.originalEvent;

		if (e.preventDefault) {
			e.preventDefault();
		} else {
			/* IE下阻止默认事件 */
			e.returnValue = false;
		}
	},
	
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = true;

		if (e.stopPropagation) {
			e.stopPropagation();
		}
	}
};

RR.eventCache = {};

RR.eventType = {
	delegated: '|click|mouseover|mouseout|mousemove|focus|blur|touchstart|touchmove|touchend|',
	captured: '|focus|blur|'
};

RR.addEvent = DOC.addEventListener ? function(type, element, fn, capture) {
	element.addEventListener(type, fn, capture);
} : function(type, element, fn, capture) {
	element.attachEvent('on' + type, fn);
};

RR.dispatchEvent = function(e) {
	var element = this,
		e = new RR.event(e),
		type = e.type,
		elCur = e.target,
		eventData = RR.eventCache[type] || {};

	/* 在触屏浏览器中，只执行在touchend中合成的click事件
	 * 在触屏浏览（合成的时候给event对象添加了自定义的isSimulated属性） 
	 */
	if ('click' === type && IsTouch && !e.originalEvent.isSimulated) {
		e.preventDefault();
		return;
	}

	while(elCur) {
		var uid = RR.fn.uid(elCur),
		elemData = eventData[uid],
		result = true;

		if (elemData) {
			for (var i = 0, l = elemData.length; i < l; i++) {
				//e.currentTarget = elCur;
				var re = elemData[i].apply(elCur, [e]);
				
				//有任一方法返回false的话标记result为false
				if (false === re) {
					result = re;
				}
			}
		}
		
		//如果任一绑定给对象的方法返回false，停止默认事件并终止冒泡
		if (false === result) {
			e.preventDefault();
			e.stopPropagation();
		}
		if (true === e.isPropagationStopped) {
			break;
		}
		elCur = elCur.parentNode;
	}
};

RR.fn.prototype.on = function(type, fn) {
	return this.each(function(element) {
		var uid = RR.fn.uid(element);

		var eventData = RR.eventCache[type] || (RR.eventCache[type] = {}),
			elemData = eventData[uid] || (eventData[uid] = []),
			capture = (-1 !== RR.eventType.captured.indexOf(type));
			
		/* 在第一次给某个DOM对象添加事件的时候绑定RR.dispatchEvent()方法，
		 * 后续添加的方法推入elemData数组在RR.dispatchEvent()中调用 */
		if (elemData.length < 1) {

			/* 把需要委托的事件绑定在document上面 */
			if (-1 !== RR.eventType.delegated.indexOf(type)) {
				element = DOC;
			}
			RR.addEvent(type, element, RR.dispatchEvent, capture);
		}
		elemData.push(fn);
	});
};

RR.fn.prototype.trigger = function(type, data) {
	var theEvent = DOC.createEvent('MouseEvents');
	theEvent.initEvent(type, true, true);
	theEvent.data = data;
	theEvent.isSimulated = true;

	return this.each(function(element) {
		element.dispatchEvent && element.dispatchEvent(theEvent);
	});
};

/**
 * 实现触屏的点击事件委托
 * 它做的事情：
 * 1. 去掉click事件在移动浏览器中的延迟
 * 2. 实现被点击对象的按压效果
 */
RR.touchEvent = {
	activeCls: 'active',
	hasTouchStart: false,

	init: function() {
		var events = {
			onTouchStart: 'touchstart',
			onTouchMove: 'touchmove',
			onTouchEnd: 'touchend',
			onTouchCancel: 'touchcancel'
		},
		type;
		
		for (type in events) {
			RR.addEvent(events[type], DOC, RR.touchEvent[type], false);
		}
	},

	onTouchStart: function(e) {
		var e = new RR.event(e),
			event = e.originalEvent,
			elCur = e.target,
			eventData = RR.eventCache['click'] || {};

		RR.touchEvent.clearHighlight();

		RR.touchEvent.hasTouchStart = true;

		/* 保留一个target引用，在touchend中分配点击事件给这个target */
		RR.touchEvent.elTarget = elCur;

		/* 事件触发点相对于窗口的坐标 */
		RR.touchEvent.startPoint = [event.screenX, event.screenY]; 

		RR.touchEvent.targets = [];
		while(elCur) {
			var uid = RR.fn.uid(elCur),
				elemData = eventData[uid];

			/* 为绑定了事件或者特定DOM对象添加高亮样式 */
			if (elemData || ['A', 'INPUT', 'BUTTON'].indexOf(elCur.nodeName) > -1) {
				RR.touchEvent.targets.push(RR.$(elCur).addClass(RR.touchEvent.activeCls));
			}
			elCur = elCur.parentNode;
		}
	},

	onTouchMove: function(e) {
		var touch = RR.touchEvent;
		if (touch.hasTouchStart) {
			var e = new RR.event(e),
				event = e.originalEvent,
				movedDistance = Math.pow(Math.pow(event.screenX - touch.startPoint[0], 2) 
				                         + Math.pow(event.screenY - touch.startPoint[1], 2), .5);

			if (movedDistance > MAX_TOUCHMOVE_DISTANCE_FOR_CLICK) {
				touch.onTouchCancel();
			}
		}
	},

	onTouchEnd: function() {
		if (RR.touchEvent.hasTouchStart) {
			var theEvent = DOC.createEvent('MouseEvents'),
				target = RR.touchEvent.elTarget;

			/* 先做清除工作，再触发合成事件 */
			RR.touchEvent.onTouchCancel();

			/* 初始化冒泡的事件 */
			theEvent.initEvent('click', true, true);

			/* 标记事件为合成的模拟事件，在RR.dispatchEvent()方法中会检测这个属性来判断是否需要触发click事件 */
			theEvent.isSimulated = true;

			/* 给目标DOM对象触发合成事件
			 * （目标DOM对象是touchstart事件的target对象，touchstart和touchend的target可能不一样，所以在touchstart里面保留了一个引用） 
			 */
			target.dispatchEvent(theEvent);
		}
	},

	onTouchCancel: function() {
		RR.touchEvent.hasTouchStart = false;
		RR.touchEvent.elTarget = null;

		/* 取消DOM的高亮状态之前保留一个延时，使用户可以觉察到状态的改变 */
		setTimeout(RR.touchEvent.clearHighlight, 200);
	},

	clearHighlight: function() {
		var targets = RR.touchEvent.targets,
			activeCls = RR.touchEvent.activeCls;
		if (targets) {
			/* 移除高亮样式 */
			for (var i = 0, l = targets.length; i < l; i++) {
				targets[i].removeClass(activeCls);
			}
			RR.touchEvent.targets = null;
		}
	}
}

if (IsTouch) {
	RR.touchEvent.init();
}
