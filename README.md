# BSelect

سلکت (Select) سفارشی و کامل با **جاوااسکریپت خالص**؛ بدون هیچ وابستگی، بدون build و بدون فایل CSS جدا.
تمام استایل‌ها داخل همان فایل `bselect.js` تعریف شده‌اند و همه‌ی کلاس‌ها با حرف **B** شروع می‌شوند تا با کلاس‌های برنامه‌ی شما تداخل نداشته باشند.

> نسخه: `1.0.0` · مجوز: `GPL-3.0-or-later`

---

## فهرست

- [ویژگی‌ها](#ویژگیها)
- [شروع سریع](#شروع-سریع)
- [روش‌های ورود داده](#روشهای-ورود-داده)
- [تنظیمات (Options)](#تنظیمات-options)
- [متدهای عمومی](#متدهای-عمومی)
- [رویدادها و callbackها](#رویدادها-و-callbackها)
- [دسته‌بندی و صفحه‌بندی](#دستهبندی-و-صفحهبندی)
- [ظاهر و تم](#ظاهر-و-تم)
- [کیبورد و دسترس‌پذیری](#کیبورد-و-دسترسپذیری)
- [ساختار پروژه و اجرای دمو](#ساختار-پروژه-و-اجرای-دمو)
- [سازگاری](#سازگاری)

---

## ویژگی‌ها

| ویژگی | توضیح |
| --- | --- |
| بدون وابستگی | نه jQuery، نه Bootstrap، نه هیچ ماژول دیگری |
| CSS داخل JS | یک فایل `bselect.js`؛ استایل به‌صورت خودکار و فقط یک‌بار تزریق می‌شود |
| کلاس‌های یونیک | همه‌ی کلاس‌ها با `BSelect` شروع می‌شوند (`BSelect__option`، `BSelect__dropdown`، …) |
| تک‌انتخابی / چندانتخابی | در حالت چند انتخابی چک‌باکس، چیپ (chip) و «انتخاب همه» اضافه می‌شود |
| جستجو | قابل فعال/غیرفعال کردن حتی بعد از ساخت؛ نرمال‌سازی «ی/ي» و «ک/ك» و هایلایت نتیجه |
| دسته‌بندی | گروه‌های قابل جمع‌شدن + چک‌باکس انتخاب کل گروه |
| صفحه‌بندی | کلاینت‌ساید، با اندازه‌ی صفحه‌ی قابل تنظیم و اطلاعات «نمایش x تا y از z» |
| ورود داده از چند منبع | آرایه، آبجکت، `<select>` واقعی، رشته JSON، فایل/URL JSON، رشته HTML، `<template>` و تابع async |
| callback بعد از انتخاب | `onChange` / `onSelect` / `onDeselect` و رویدادهای `CustomEvent` |
| کنترل کامل با کد | `setValues`، `select`، `clear`، `setData`، `addOptions`، `setSearchable`، `setMultiple`، … |
| RTL/LTR | پیش‌فرض راست‌به‌چپ؛ با `rtl: false` چپ‌به‌راست |
| دسترس‌پذیری | نقش‌های ARIA، ناوبری کیبورد، بسته‌شدن با Escape، `aria-activedescendant` |
| بدون نشت حافظه | `destroy()` همه‌چیز را به حالت اول برمی‌گرداند و استایل مشترک را در آخرین نمونه حذف می‌کند |

---

## شروع سریع

```html
<script src="bselect.js"></script>

<div id="city"></div>

<script>
  const select = new BSelect(document.getElementById('city'), {
    data: ['تهران', 'شیراز', 'تبریز', 'مشهد'],
    searchable: true,
    placeholder: 'شهر را انتخاب کنید',
    onChange: ({ value, item }) => {
      console.log(value);       // "shiraz"
      console.log(item.label);  // "شیراز"
    }
  });
</script>
```

اگر ماژول را با `<script type="module">` یا bundler استفاده می‌کنید:

```js
import BSelect from './bselect.js';

const select = BSelect.create(document.querySelector('#city'), {
  data: ['تهران', 'شیراز', 'تبریز']
});
```

`new BSelect(el, options)` و `BSelect.create(el, options)` هر دو یک کار را انجام می‌دهند.

---

## روش‌های ورود داده

### ۱) آرایه‌ی ساده

```js
new BSelect(el, { data: ['تهران', 'شیراز', 'تبریز'] });
```

### ۲) آرایه‌ی آبجکت‌ها

```js
new BSelect(el, {
  data: [
    { value: 'tehran', label: 'تهران', description: 'پایتخت ایران' },
    { value: 'shiraz', label: 'شیراز', description: 'مرکز فارس', group: 'استان فارس' },
    { value: 'isfahan', label: 'اصفهان', disabled: true }
  ]
});
```

کلیدهای پشتیبانی‌شده: `value`، `label`، `description`/`desc`، `disabled`، `selected`، `group`.
اگر `value` نداشته باشد از `id` یا `label` استفاده می‌شود.

### ۳) گروه‌بندی‌شده

```js
new BSelect(el, {
  data: [
    { label: 'استان تهران', options: [
      { value: 'tehran', label: 'تهران' },
      { value: 'varamin', label: 'ورامین' }
    ] },
    { label: 'استان فارس', options: [
      { value: 'shiraz', label: 'شیراز' },
      { value: 'lar', label: 'لار' }
    ] }
  ]
});
```

یا با شکل `{ groups: [...] }` و یا با قرار دادن فیلد `group` روی هر آیتم (مثل نمونه‌ی ۲).

### ۴) از یک `<select>` واقعی

```html
<select id="city">
  <optgroup label="استان تهران">
    <option value="tehran" selected>تهران</option>
    <option value="varamin">ورامین</option>
  </optgroup>
</select>

<script>
  new BSelect(document.getElementById('city'), { searchable: true });
</script>
```

گزینه‌ها، `optgroup`ها، مقدار `selected`، `disabled` و `name` (برای ارسال فرم) خوانده می‌شوند.
سلکت اصلی مخفی می‌شود ولی در فرم باقی می‌ماند؛ `destroy()` آن را دقیقاً به جای اولش برمی‌گرداند.

### ۵) رشته‌ی JSON

```js
new BSelect(el, {
  data: '[{"value":"fa","label":"فارسی"},{"value":"en","label":"English"}]'
});
```

### ۶) فایل یا endpoint JSON

```js
new BSelect(el, {
  dataUrl: 'data/cities.json',   // یا '/api/cities'
  dataType: 'json',              // 'json' (پیش‌فرض) یا 'html'
  searchable: true,
  pagination: true,
  pageSize: 6,
  onLoad: ({ count }) => console.log(count),
  onError: ({ error }) => console.warn(error)
});
```

### ۷) رشته‌ی HTML

```js
new BSelect(el, {
  data: `
    <ul>
      <li data-value="k1">کلید یک</li>
      <li data-value="k2" data-description="توضیح">کلید دو</li>
    </ul>`
});
```

همچنین `<select>`، `<option>`های تکی و ساختار تودرتوی `<ul>` برای گروه‌ها پذیرفته می‌شود.

### ۸) از یک `<template>`

```html
<template id="city-template">
  <option value="rasht">رشت</option>
  <option value="yazd">یزد</option>
</template>

<script>
  new BSelect(el, { data: 'city-template' });
</script>
```

### ۹) تابع async (مناسب API)

```js
new BSelect(el, {
  value: 'isfahan',        // حتی قبل از رسیدن داده هم قابل تعیین است
  searchable: true,
  asyncData(done, fail) {
    fetch('/api/cities')
      .then((response) => response.json())
      .then(done)
      .catch(fail);
  }
});
```

در طول بارگذاری، اسپینر نمایش داده می‌شود (`BSelect--loading`). برای بارگذاری دوباره از `reload()` استفاده کنید.

### ۱۰) روش imperative

```js
const select = new BSelect(el, { data: [] });
select.setData(['a', 'b', 'c']);
select.addOptions([{ value: 'd', label: 'D' }], 'گروه جدید');
select.removeOption('d');
```

---

## تنظیمات (Options)

| گزینه | پیش‌فرض | توضیح |
| --- | --- | --- |
| `data` | `null` | آرایه، آبجکت، رشته JSON، رشته HTML یا شناسه‌ی `<template>` |
| `dataUrl` | `null` | آدرس فایل JSON/HTML |
| `dataType` | `'json'` | نوع پاسخ `dataUrl` |
| `asyncData` | `null` | `function(done, fail)` برای بارگذاری دستی |
| `fetchOptions` | `null` | تنظیمات `fetch()` |
| `value` | `null` | مقدار اولیه (رشته یا آرایه) |
| `multiple` | `false` | حالت چند انتخابی |
| `searchable` | `false` | نمایش جستجو |
| `searchPlaceholder` | `'جستجو…'` | متن placeholder جستجو |
| `groups` | `true` | نمایش گروه‌ها |
| `groupsCollapsed` | `false` | همه‌ی گروه‌ها در ابتدا بسته باشند |
| `groupCollapsible` | `true` | تیتر گروه قابل باز/بستن باشد |
| `groupSelectable` | `true` | دکمه‌ی «انتخاب گروه / حذف گروه» در تیتر گروه (فقط حالت چند انتخابی) |
| `groupSelectText` | `'انتخاب گروه'` | متن دکمه‌ی انتخاب گروه |
| `groupClearText` | `'حذف گروه'` | متن دکمه وقتی همه‌ی اعضای گروه انتخاب شده‌اند |
| `pagination` | `false` | فعال‌سازی صفحه‌بندی |
| `pageSize` | `10` | تعداد آیتم در هر صفحه |
| `placeholder` | `'انتخاب کنید…'` | متن حالت خالی |
| `disabled` | `false` | غیرفعال |
| `closeOnSelect` | `null` | پیش‌فرض: تک‌انتخابی `true`، چندانتخابی `false` |
| `maxSelected` | `0` | سقف انتخاب در حالت چند انتخابی (`0` = بی‌نهایت) |
| `name` | `null` | نام input(های) مخفی برای ارسال فرم |
| `zIndex` | `60` | لایه‌ی dropdown |
| `rtl` | `true` | چیدمان راست‌به‌چپ |
| `ariaLabel` | `null` | برچسب دسترس‌پذیری |
| `emptyText` | `'گزینه‌ای برای نمایش وجود ندارد'` | متن لیست خالی |
| `noResultsText` | `'نتیجه‌ای پیدا نشد'` | متن وقتی جستجو نتیجه ندارد |
| `loadingText` | `'در حال بارگذاری…'` | متن هنگام بارگذاری `dataUrl`/`asyncData` |
| `selectAllText` | `'انتخاب همه'` | متن دکمه‌ی انتخاب همه |
| `clearAllText` | `'حذف همه'` | متن دکمه وقتی همه انتخاب شده‌اند |
| `selectedCountText` | `'{n} مورد انتخاب شده'` | شمارنده |
| `totalCountText` | `'{n} مورد'` | شمارنده‌ی کل |
| `pageInfoText` | `'نمایش {from} تا {to} از {total}'` | متن صفحه‌بندی |
| `groupToggleText` | `'باز و بستن گروه'` | متن `aria-label` دکمه‌ی باز/بستن گروه |
| `removeText` | `'حذف'` | متن `aria-label` دکمه‌ی حذف چیپ |
| `texts` | — | بازنویسی گروهی متن‌ها: `{ texts: { noResultsText: '...' } }` |
| `onChange` `onSelect` `onDeselect` `onOpen` `onClose` `onSearch` `onPageChange` `onLoad` `onMaxSelected` `onClear` `onToggle` `onError` | `null` | callbackها |

مثال بازنویسی متن‌ها:

```js
new BSelect(el, {
  texts: {
    placeholder: 'Choose…',
    noResultsText: 'Nothing found',
    selectAllText: 'Select all'
  },
  rtl: false
});
```

---

## متدهای عمومی

| متد | خروجی | توضیح |
| --- | --- | --- |
| `getValue()` | `string \| string[] \| null` | مقدار انتخاب‌شده |
| `getValues()` | `string[]` | همیشه آرایه |
| `getSelectedItems()` | `object[]` | `{ value, label, description, disabled, group, data }` |
| `getOptions()` | `object[]` | همه‌ی گزینه‌ها |
| `setValues(values, opts?)` | `this` | جایگزینی انتخاب‌ها؛ `opts.reason` و `opts.silent` پشتیبانی می‌شوند |
| `setValue(value)` | `this` | همان `setValues` |
| `select(value)` | `this` | افزودن یک مقدار |
| `deselect(value)` | `this` | حذف یک مقدار |
| `toggleValue(value)` | `this` | جابه‌جایی انتخاب |
| `selectAll()` | `this` | انتخاب همه‌ی گزینه‌های قابل انتخاب |
| `clear(opts?)` | `this` | حذف همه (با `silent: true` بدون رویداد) |
| `setData(data, opts?)` | `this` | جایگزینی داده‌ها؛ `keepSelection` پیش‌فرض `true` |
| `addOptions(items, groupLabel?)` | `this` | افزودن گزینه/گروه |
| `removeOption(value)` | `this` | حذف گزینه |
| `setSearchable(bool)` | `this` | روشن/خاموش کردن جستجو |
| `setMultiple(bool)` | `this` | تغییر حالت انتخاب |
| `setDisabled(bool)` / `enable()` / `disable()` | `this` | فعال/غیرفعال |
| `setOption(name, value)` | `this` | تغییر یک تنظیم |
| `getOption(name)` | `any` | خواندن یک تنظیم |
| `open()` / `close(returnFocus?)` / `toggle()` | `this` | کنترل لیست |
| `isOpen()` | `boolean` | وضعیت باز بودن |
| `reload()` | `this` | بارگذاری دوباره‌ی `asyncData`/`dataUrl` |
| `refresh()` | `this` | رندر دوباره |
| `focus()` | `this` | فوکوس روی کنترل |
| `on(event, handler)` / `off(event, handler)` | `this` | اشتراک در رویدادها؛ `handler(detail, instance, event)` — با یا بدون پیشوند `bselect:` |
| `destroy()` | — | حذف کامل و بازگرداندن HTML اولیه |

مثال خواندن نتیجه‌ی چند انتخابی:

```js
const skills = new BSelect(el, { data: skillsList, multiple: true });

skills.on('change', (payload) => {
  console.log(payload.values);  // ['js', 'css']
  console.log(payload.items);   // [{ value, label, group, data }, …]
});

console.log(skills.getValues());
console.log(skills.getSelectedItems());
```

---

## رویدادها و callbackها

همه‌ی رویدادها به‌صورت `CustomEvent` روی **خود المان اصلی** و روی **wrapper** (`el.nextElementSibling` یا `.BSelect`) منتشر می‌شوند و به بالا حباب می‌کنند. علاوه بر آن می‌توانید callback هم در تنظیمات بدهید.

| رویداد | callback | `detail` |
| --- | --- | --- |
| `bselect:change` | `onChange` | `{ multiple, value, values, item, items, reason }` |
| `bselect:select` | `onSelect` | همان + `item` گزینه‌ی انتخاب‌شده |
| `bselect:deselect` | `onDeselect` | همان + `item` گزینه‌ی حذف‌شده |
| `bselect:open` | `onOpen` | `{ value, values }` |
| `bselect:close` | `onClose` | `{ value, values }` |
| `bselect:search` | `onSearch` | `{ term, count }` |
| `bselect:pagechange` | `onPageChange` | `{ page, pages, pageSize, total }` |
| `bselect:maxselected` | `onMaxSelected` | `{ max, count, item, values }` |
| `bselect:load` | `onLoad` | `{ count, groups, value, values }` |
| `bselect:clear` | `onClear` | `payload` |
| `bselect:toggle` | `onToggle` | `{ type: 'group', group, collapsed }` |
| `bselect:error` | `onError` | `{ error }` |

نمونه:

```js
document.getElementById('city').addEventListener('bselect:change', (event) => {
  console.log(event.detail.values);
});

select.on('pagechange', ({ page, pages }) => console.log(page, pages));
```

> در حالت تک‌انتخابی `value` یک رشته است؛ در حالت چند انتخابی `value` و `values` هر دو آرایه‌اند.

---

## دسته‌بندی و صفحه‌بندی

```js
new BSelect(el, {
  data: cities,          // هر آیتم { value, label, group: 'استان تهران' }
  multiple: true,
  searchable: true,
  pagination: true,
  pageSize: 4,
  groupsCollapsed: false,
  groupCollapsible: true
});
```

- کلیک روی تیتر گروه، گروه را باز/بسته می‌کند و رویداد `toggle` را می‌فرستد
  (با `groupCollapsible: false` تیتر ثابت می‌شود).
- در حالت چند انتخابی، دکمه‌ی «انتخاب گروه» / «حذف گروه» در همان ردیف تیتر، همه‌ی اعضای
  گروه (مطابق فیلتر فعلی) را انتخاب یا حذف می‌کند (`groupSelectable: false` آن را حذف می‌کند).
- جستجو گزینه‌های داخل گروه‌های بسته را هم پیدا می‌کند و تا وقتی عبارت جستجو پاک نشده،
  گروه‌ها باز نمایش داده می‌شوند.
- جستجو کل لیست را فیلتر می‌کند، صفحه به ۱ برمی‌گردد و تعداد نتایج هر گروه روی تیتر نمایش داده می‌شود.
- صفحه‌بندی با کلیدهای `‹` و `›` و شماره‌ها انجام می‌شود؛ با `ArrowUp/ArrowDown` هم می‌توان بین صفحات حرکت کرد.

---

## کلاس‌های CSS

همه‌ی کلاس‌ها با `BSelect` شروع می‌شوند؛ لیست کامل برای وقتی که بخواهید استایل خودتان را اضافه کنید:

| کلاس | نقش |
| --- | --- |
| `BSelect` | ریشه‌ی کامپوننت |
| `BSelect--multiple` / `BSelect--disabled` / `BSelect--open` / `BSelect--ltr` / `BSelect--dropup` / `BSelect--loading` / `BSelect--focused` / `BSelect--shake` | حالت‌های ریشه |
| `BSelect__control` / `BSelect__value` / `BSelect__value--placeholder` | کنترل و مقدار نمایش‌داده‌شده |
| `BSelect__chips` / `BSelect__chip` / `BSelect__chipText` / `BSelect__chipX` / `BSelect__chipMore` | چیپ‌های حالت چند انتخابی |
| `BSelect__arrow` / `BSelect__spinner` | فلش و اسپینر |
| `BSelect__dropdown` / `BSelect__header` / `BSelect__header--empty` | پنل بازشو و هدر آن |
| `BSelect__searchWrap` / `BSelect__search` / `BSelect__searchIcon` | جستجو |
| `BSelect__toolbar` / `BSelect__selectAll` / `BSelect__count` | نوار «انتخاب همه» |
| `BSelect__list` / `BSelect__empty` | لیست و پیام خالی |
| `BSelect__group` / `BSelect__groupHead` / `BSelect__groupToggle` / `BSelect__groupAction` / `BSelect__groupTitle` / `BSelect__groupBadge` / `BSelect__groupCaret` / `BSelect__groupBody` | گروه‌ها |
| `BSelect__option` / `BSelect__option--selected` / `BSelect__option--disabled` / `BSelect__option--active` | گزینه‌ها |
| `BSelect__checkbox` / `--checked` / `--indeterminate` | چک‌باکس‌ها |
| `BSelect__label` / `BSelect__desc` / `BSelect__mark` / `BSelect__tick` | متن گزینه، توضیح، هایلایت و تیک |
| `BSelect__footer` / `BSelect__pages` / `BSelect__pageBtn` / `BSelect__nav` / `BSelect__pageInfo` / `BSelect__pageDots` | صفحه‌بندی |
| `BSelect__nativeWrap` / `BSelect__native` | المان اصلی مخفی و inputهای مخفی |

## ظاهر و تم

استایل‌ها با متغیرهای CSS تعریف شده‌اند؛ روی هر container بازنویسی کنید:

```css
.my-panel .BSelect {
  --B-primary: #7c3aed;
  --B-primary-soft: rgba(124, 58, 237, 0.13);
  --B-border: #ddd6fe;
  --B-border-strong: #c4b5fd;
  --B-text: #1f2937;
  --B-muted: #6b7280;
  --B-bg: #ffffff;
  --B-bg-soft: #f7f5ff;
  --B-radius: 16px;
  --B-shadow: 0 18px 40px -18px rgba(76, 29, 149, 0.45);
}
```

برای چیدمان چپ‌به‌راست:

```js
new BSelect(el, { rtl: false });
// یا بعداً:
select.setOption('rtl', false); // کلاس BSelect--ltr
```

> استایل مشترک فقط یک‌بار در `<style id="BSelect-styles">` تزریق می‌شود و با `destroy()` آخرین نمونه حذف می‌شود.

---

## کیبورد و دسترس‌پذیری

| کلید | عملکرد |
| --- | --- |
| `Enter` / `Space` / `ArrowDown` | باز کردن لیست |
| `ArrowDown` / `ArrowUp` | حرکت بین گزینه‌ها (و صفحه‌های بعد/قبل) |
| `Home` / `End` | اولین / آخرین گزینه |
| `Enter` | انتخاب گزینه‌ی فعال (در کادر جستجو هم) |
| `Escape` | بستن لیست |
| `Backspace` | حذف آخرین انتخاب در حالت چند انتخابی |
| `Tab` | بستن و رفتن به المان بعدی |
| تایپ حرف (در حالت جستجو) | باز کردن لیست و شروع جستجو |

نقش‌های `combobox`، `listbox`، `option`، `aria-selected`، `aria-expanded`، `aria-activedescendant`، `aria-multiselectable` و یک ناحیه‌ی `aria-live` برای اعلام تعداد انتخاب‌ها تنظیم می‌شوند.

---

## ساختار پروژه و اجرای دمو

```
bselect.js              ← کل کتابخانه (JS + CSS)
data/cities.json        ← داده‌ی نمونه برای دمو
demo/index.html         ← صفحه‌ی دمو با ۱۱ نمونه‌ی تعاملی
demo/demo.js            ← راه‌اندازی نمونه‌ها
demo/demo.css           ← استایل صفحه‌ی دمو (جدا از کتابخانه)
test/bselect.test.js    ← ۲۲ تست واحد با jsdom
test/demo.smoke.js      ← تست دودِ صفحه‌ی دمو در jsdom
tools/serve.js          ← سرور استاتیک بدون وابستگی
```

اجرا:

```bash
npm install        # فقط jsdom برای تست
npm test           # تست‌های واحد
npm run test:demo  # تست صفحه‌ی دمو (سرور را خودش بالا می‌آورد)
npm run test:all   # هر دو
npm run demo       # http://localhost:4173/demo/
```

برای دیدن دمو بدون npm هم می‌توانید `demo/index.html` را با هر سرور استاتیک دیگری باز کنید. (باز کردن مستقیم با `file://` باعث می‌شود `fetch` فایل JSON محدود شود.)

---

## سازگاری

- مرورگرهای مدرن: Chrome/Edge 90+، Firefox 88+، Safari 14+
- بدون polyfill و بدون build؛ خروجی UMD (هم `window.BSelect`، هم CommonJS و هم AMD)
- وابستگی صفر؛ فقط از `fetch` برای `dataUrl` استفاده می‌کند (که در همه‌ی مرورگرهای هدف موجود است)

---

## مجوز

GPL-3.0-or-later — فایل `LICENSE` را ببینید.
