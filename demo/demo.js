/* ==========================================================================
   BSelect demo – all examples live here.
   ========================================================================== */
(function () {
  'use strict';

  var B = window.BSelect;
  if (!B) {
    document.body.insertAdjacentHTML('afterbegin',
      '<p style="padding:20px;color:#b42318;font-family:Tahoma">bselect.js بارگذاری نشد.</p>');
    return;
  }

  /* ------------------------------------------------------------ utilities */

  function $(id) { return document.getElementById(id); }
  function text(id, value) {
    var node = $(id);
    if (node) node.textContent = value;
  }
  function fa(value) {
    try {
      return new Intl.NumberFormat('fa-IR').format(value);
    } catch (err) {
      return String(value);
    }
  }

  var logEl = $('event-log');
  var logCount = 0;

  function pushLog(source, eventName, details) {
    if (!logEl) return;
    logCount += 1;
    var li = document.createElement('li');
    var time = new Date().toLocaleTimeString('fa-IR');
    li.innerHTML =
      '<span class="demo-log-source">' + escapeHtml(source) + '</span> · ' +
      '<span class="demo-log-name">' + escapeHtml(eventName) + '</span> · ' +
      '<span class="demo-log-value">' + escapeHtml(details || '') + '</span>' +
      ' <span style="opacity:.5">' + escapeHtml(time) + '</span>';
    logEl.appendChild(li);
    while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindLog(instance, name) {
    if (!instance) return;
    instance.on('change', function (payload) {
      pushLog(name, 'change', JSON.stringify(payload.values));
    });
    instance.on('pagechange', function (payload) {
      pushLog(name, 'pagechange', 'page ' + payload.page + '/' + payload.pages);
    });
    instance.on('maxselected', function (payload) {
      pushLog(name, 'maxselected', 'limit = ' + payload.max);
    });
    instance.on('load', function (payload) {
      pushLog(name, 'load', payload.count + ' items / ' + payload.groups + ' groups');
    });
    instance.on('toggle', function (payload) {
      pushLog(name, 'toggle', (payload.group && payload.group.label ? payload.group.label : 'group') +
        ' → ' + (payload.collapsed ? 'بسته' : 'باز'));
    });
    instance.on('clear', function () {
      pushLog(name, 'clear', '');
    });
  }

  var cityList = [
    { value: 'tehran', label: 'تهران', description: 'پایتخت ایران', group: 'استان تهران' },
    { value: 'varamin', label: 'ورامین', description: 'جنوب استان تهران', group: 'استان تهران' },
    { value: 'shahriar', label: 'شهریار', description: 'غرب استان تهران', group: 'استان تهران' },
    { value: 'eslamshahr', label: 'اسلامشهر', description: 'جنوب غربی تهران', group: 'استان تهران' },
    { value: 'shiraz', label: 'شیراز', description: 'مرکز استان فارس', group: 'استان فارس' },
    { value: 'marvdasht', label: 'مرودشت', description: 'نزدیک تخت جمشید', group: 'استان فارس' },
    { value: 'lar', label: 'لار', description: 'جنوب استان فارس', group: 'استان فارس' },
    { value: 'isfahan', label: 'اصفهان', description: 'نصف جهان', group: 'استان اصفهان' },
    { value: 'kashan', label: 'کاشان', description: 'شهر گلاب و فرش', group: 'استان اصفهان' },
    { value: 'najafabad', label: 'نجف‌آباد', description: 'غرب اصفهان', group: 'استان اصفهان' },
    { value: 'tabriz', label: 'تبریز', description: 'مرکز آذربایجان شرقی', group: 'استان آذربایجان شرقی' },
    { value: 'maragheh', label: 'مراغه', description: 'شهر رصدخانه‌های تاریخی', group: 'استان آذربایجان شرقی' },
    { value: 'mashhad', label: 'مشهد', description: 'مرکز خراسان رضوی', group: 'استان خراسان رضوی' },
    { value: 'neyshabur', label: 'نیشابور', description: 'شهر خیام و عطار', group: 'استان خراسان رضوی' },
    { value: 'sabzevar', label: 'سبزوار', description: 'غرب خراسان رضوی', group: 'استان خراسان رضوی' },
    { value: 'rasht', label: 'رشت', description: 'مرکز گیلان', group: 'استان گیلان' },
    { value: 'lahijan', label: 'لاهیجان', description: 'شهر چای', group: 'استان گیلان' },
    { value: 'bandar_anzali', label: 'بندر انزلی', description: 'بندر شمال ایران', group: 'استان گیلان' },
    { value: 'yazd', label: 'یزد', description: 'شهر بادگیرها', group: 'استان یزد' },
    { value: 'meibod', label: 'میبد', description: 'شهر سفال و کاشی', group: 'استان یزد' }
  ];

  /* --------------------------------------------------- 1) basic (array) */

  var basic = new B($('demo-basic'), {
    data: ['تهران', 'شیراز', 'تبریز', 'مشهد', 'اصفهان', 'رشت', 'یزد'],
    placeholder: 'شهر را انتخاب کنید',
    onChange: function (payload) {
      text('out-basic', payload.value ? payload.item.label + ' (' + payload.value + ')' : '—');
    }
  });
  bindLog(basic, 'basic');

  /* --------------------------------------------- 2) search toggle */

  var searchDemo = new B($('demo-search'), {
    data: cityList.slice(0, 10),
    searchable: true,
    placeholder: 'جستجو میان شهرها…',
    onChange: function (payload) {
      text('out-search', payload.value ? payload.item.label : '—');
    }
  });
  bindLog(searchDemo, 'search');

  var searchToggle = document.querySelector('[data-action="toggle-search"]');
  if (searchToggle) {
    searchToggle.addEventListener('click', function () {
      var next = !searchDemo.getOption('searchable');
      searchDemo.setSearchable(next);
      var pill = $('search-state');
      if (pill) {
        pill.textContent = next ? 'جستجو: فعال' : 'جستجو: غیرفعال';
        pill.setAttribute('data-off', next ? '0' : '1');
      }
      pushLog('search', 'setSearchable', String(next));
    });
  }

  /* ------------------------------------------------ 3) native select */

  var nativeEl = $('native-select');
  if (nativeEl) {
    var nativeDemo = new B(nativeEl, {
      searchable: true,
      placeholder: 'انتخاب استان…',
      onChange: function (payload) {
        text('out-native', payload.value ? payload.item.label + ' — ' + payload.item.group : '—');
      }
    });
    bindLog(nativeDemo, 'native');
    if (nativeDemo.getValue()) {
      text('out-native', nativeDemo.getSelectedItems()[0].label + ' — ' +
        nativeDemo.getSelectedItems()[0].group);
    }
  }

  /* ------------------------------------------------------- 4) JSON */

  var jsonStatus = $('out-json-status');
  var jsonDemo = new B($('demo-json'), {
    dataUrl: '../data/cities.json',
    searchable: true,
    pagination: true,
    pageSize: 6,
    placeholder: 'یک شهر از فایل JSON…',
    onLoad: function (payload) {
      if (jsonStatus) jsonStatus.textContent = 'بارگذاری شد: ' + fa(payload.count) + ' شهر در ' + fa(payload.groups) + ' استان';
    },
    onError: function (payload) {
      if (jsonStatus) jsonStatus.textContent = 'خطا در بارگذاری فایل JSON';
      console.warn('JSON load failed', payload.error);
    },
    onChange: function (payload) {
      text('out-json', payload.value ? payload.item.label : '—');
    }
  });
  bindLog(jsonDemo, 'json');

  /* ------------------------------------------------------- 5) HTML */

  var htmlDemo = new B($('demo-html'), {
    searchable: true,
    data: '<ul>' +
      '<li data-value="k1">کلید یک</li>' +
      '<li data-value="k2">کلید دو</li>' +
      '<li data-value="k3">کلید سه</li>' +
      '<li data-value="k4">کلید چهار</li>' +
      '</ul>',
    placeholder: 'از رشته‌ی HTML…',
    onChange: function (payload) {
      text('out-html', payload.value ? payload.item.label + ' (' + payload.value + ')' : '—');
    }
  });
  bindLog(htmlDemo, 'html');

  /* --------------------------------------------------- 6) template */

  var templateDemo = new B($('demo-template'), {
    data: 'city-template',
    searchable: true,
    placeholder: 'از <template>…',
    onChange: function (payload) {
      text('out-template', payload.value ? payload.item.label : '—');
    }
  });
  bindLog(templateDemo, 'template');

  /* -------------------------------------------------- 7) multiple */

  var skills = [
    { value: 'js', label: 'JavaScript', description: 'زبان اصلی وب' },
    { value: 'ts', label: 'TypeScript', description: 'تایپ‌سیف‌تی برای JS' },
    { value: 'css', label: 'CSS', description: 'استایل و طراحی' },
    { value: 'html', label: 'HTML', description: 'ساختار صفحات' },
    { value: 'php', label: 'PHP', description: 'زبان سمت سرور' },
    { value: 'python', label: 'Python', description: 'زبان عمومی و داده' },
    { value: 'go', label: 'Go', description: 'زبان سریع و همزمان' },
    { value: 'sql', label: 'SQL', description: 'پایگاه داده' },
    { value: 'git', label: 'Git', description: 'کنترل نسخه' },
    { value: 'docker', label: 'Docker', description: 'کانتینر' },
    { value: 'figma', label: 'Figma', description: 'طراحی رابط' },
    { value: 'node', label: 'Node.js', description: 'جاوااسکریپت سمت سرور' }
  ];

  var multiDemo = new B($('demo-multi'), {
    data: skills,
    multiple: true,
    searchable: true,
    maxSelected: 4,
    placeholder: 'مهارت‌های خود را انتخاب کنید',
    onChange: function (payload) {
      var labels = payload.items.map(function (item) { return item.label; });
      text('out-multi', labels.length ? labels.join('، ') : '—');
      var itemsEl = $('out-multi-items');
      if (itemsEl) {
        itemsEl.textContent = payload.items.length
          ? JSON.stringify(payload.items.map(function (item) {
            return { value: item.value, label: item.label };
          }))
          : '[]';
      }
    }
  });
  bindLog(multiDemo, 'multiple');

  /* ---------------------------------------- 8) groups + pagination */

  var groupedDemo = new B($('demo-grouped'), {
    data: cityList,
    multiple: true,
    searchable: true,
    pagination: true,
    pageSize: 4,
    groupsCollapsed: false,
    groupCollapsible: true,
    placeholder: 'شهرها (دسته‌بندی‌شده)…',
    onChange: function (payload) {
      text('out-grouped', fa(payload.values.length));
    }
  });
  bindLog(groupedDemo, 'grouped');

  /* ------------------------------------------------------ 9) async */

  var asyncDemo = new B($('demo-async'), {
    value: 'isfahan',
    searchable: true,
    pagination: true,
    pageSize: 5,
    placeholder: 'در حال دریافت از سرور…',
    asyncData: function (done, fail) {
      setTimeout(function () {
        if (Math.random() < 0.04) {
          fail(new Error('simulated network error'));
          return;
        }
        done({
          groups: [
            { label: 'شهرهای پرجمعیت', options: [
              { value: 'tehran', label: 'تهران', description: 'پایتخت' },
              { value: 'mashhad', label: 'مشهد', description: 'خراسان رضوی' },
              { value: 'isfahan', label: 'اصفهان', description: 'نصف جهان' },
              { value: 'shiraz', label: 'شیراز', description: 'فارس' },
              { value: 'tabriz', label: 'تبریز', description: 'آذربایجان شرقی' }
            ] },
            { label: 'شهرهای ساحلی', options: [
              { value: 'rasht', label: 'رشت', description: 'گیلان' },
              { value: 'bandar_anzali', label: 'بندر انزلی', description: 'گیلان' },
              { value: 'bushehr', label: 'بوشهر', description: 'بوشهر' },
              { value: 'bandar_abbas', label: 'بندرعباس', description: 'هرمزگان' }
            ] }
          ]
        });
      }, 900);
    },
    onLoad: function (payload) {
      pushLog('async', 'load', payload.count + ' items');
      text('out-async', asyncDemo.getValue() === 'isfahan' ? 'اصفهان' : '—');
    },
    onChange: function (payload) {
      text('out-async', payload.value ? payload.item.label : '—');
    }
  });
  bindLog(asyncDemo, 'async');

  var reloadBtn = document.querySelector('[data-action="reload-async"]');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', function () {
      pushLog('async', 'reload', '');
      asyncDemo.reload();
    });
  }

  /* ------------------------------------------------- 10) API demo */

  var apiHost = $('demo-api');
  var api = null;
  var addedValues = [];
  var addSeq = 0;

  function apiState() {
    var node = $('out-api-state');
    if (!node) return;
    if (!api) {
      node.textContent = 'destroy شده (روی HTML اولیه)';
      return;
    }
    node.textContent = 'multiple=' + api.multiple +
      ' · searchable=' + api.getOption('searchable') +
      ' · disabled=' + api.disabled +
      ' · options=' + api.getOptions().length;
  }

  function apiReadout(payload) {
    var valuesEl = $('out-api-values');
    var itemsEl = $('out-api-items');
    if (valuesEl) valuesEl.textContent = JSON.stringify(payload.values);
    if (itemsEl) {
      itemsEl.textContent = JSON.stringify(payload.items.map(function (item) {
        return { value: item.value, label: item.label, group: item.group };
      }));
    }
  }

  function createApi() {
    api = new B(apiHost, {
      data: cityList,
      multiple: true,
      searchable: true,
      pagination: true,
      pageSize: 5,
      maxSelected: 8,
      placeholder: 'همه‌ی قابلیت‌ها با هم…',
      onChange: function (payload) {
        apiReadout(payload);
        apiState();
      },
      onLoad: function (payload) {
        pushLog('api', 'load', payload.count + ' items');
        apiState();
      }
    });
    bindLog(api, 'api');
    apiReadout({ values: api.getValues(), items: api.getSelectedItems() });
    apiState();
  }

  if (apiHost) {
    createApi();

    document.querySelectorAll('[data-action]').forEach(function (button) {
      var action = button.getAttribute('data-action');
      if (!action || action.indexOf('api') === -1) return;
      if (action === 'destroy-api' || action === 'recreate-api') return;
      button.addEventListener('click', function () {
        if (!api) return;
        switch (action) {
          case 'toggle-api-search':
            api.setSearchable(!api.getOption('searchable'));
            pushLog('api', 'setSearchable', String(api.getOption('searchable')));
            break;
          case 'toggle-api-multiple':
            api.setMultiple(!api.multiple);
            pushLog('api', 'setMultiple', String(api.multiple));
            break;
          case 'set-api-values':
            api.setValues(['tehran', 'shiraz']);
            pushLog('api', 'setValues', '["tehran","shiraz"]');
            break;
          case 'clear-api':
            api.clear();
            break;
          case 'add-api':
            addSeq += 1;
            var newValue = 'new-' + addSeq;
            api.addOptions([{ value: newValue, label: 'گزینه‌ی جدید ' + fa(addSeq) }], 'گزینه‌های تازه');
            addedValues.push(newValue);
            pushLog('api', 'addOptions', newValue);
            break;
          case 'remove-api':
            var last = addedValues.pop();
            if (last) api.removeOption(last);
            pushLog('api', 'removeOption', last || '—');
            break;
          case 'disable-api':
            api.disable();
            break;
          case 'enable-api':
            api.enable();
            break;
          default:
            break;
        }
        apiState();
      });
    });

    var destroyBtn = document.querySelector('[data-action="destroy-api"]');
    if (destroyBtn) {
      destroyBtn.addEventListener('click', function () {
        if (!api) return;
        api.destroy();
        api = null;
        pushLog('api', 'destroy', '');
        apiState();
      });
    }

    var recreateBtn = document.querySelector('[data-action="recreate-api"]');
    if (recreateBtn) {
      recreateBtn.addEventListener('click', function () {
        if (api) api.destroy();
        pushLog('api', 'create', '');
        createApi();
      });
    }
  }

  /* -------------------------------------------------- 11) theme */

  var themeDemo = new B($('demo-theme'), {
    data: ['طراحی', 'برنامه‌نویسی', 'محتوا', 'تحلیل داده', 'مدیریت محصول'],
    searchable: true,
    placeholder: 'با تم بنفش…',
    onChange: function (payload) {
      text('out-theme', payload.value || '—');
    }
  });
  bindLog(themeDemo, 'theme');

  /* ------------------------------------------------------ log clear */

  var clearLog = $('clear-log');
  if (clearLog) {
    clearLog.addEventListener('click', function () {
      if (!logEl) return;
      logEl.innerHTML = '';
      logCount = 0;
    });
  }

  /* ---------------------------------------------------- keyboard hint */

  pushLog('page', 'ready', 'BSelect ' + B.version + ' · instances: ' + B._liveInstances);
  void logCount;
})();
