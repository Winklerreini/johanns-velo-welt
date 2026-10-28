/*
 * Live-Vorschau für das Admin-Panel (Decap CMS).
 * Zeigt die Räder so, wie sie im Ausstellungsraum der Webseite aussehen.
 * Fällt dieses Skript aus, funktioniert das CMS trotzdem – nur die Vorschau fehlt.
 */
(function () {
  if (typeof CMS === 'undefined' || typeof h === 'undefined') return;

  try {
    CMS.registerPreviewStyle('/admin/preview.css');

    var bikeIcon = function () {
      return h(
        'svg',
        { viewBox: '0 0 120 70', 'aria-hidden': 'true' },
        h('circle', { cx: 24, cy: 48, r: 16 }),
        h('circle', { cx: 96, cy: 48, r: 16 }),
        h('path', { d: 'M24 48 L46 22 H78 L96 48 M46 22 L58 48 H24 M58 48 L78 22 M42 14 H54 M76 14 H86 L78 22' })
      );
    };

    // Frisch hochgeladene (noch nicht gespeicherte) Fotos liefert getAsset
    var imgSrc = function (props, path) {
      try {
        var asset = props.getAsset(path);
        if (asset) return asset.toString();
      } catch (e) {}
      return path;
    };

    var noClick = function (e) {
      e.preventDefault();
    };

    var buildCard = function (props, b, i) {
      var src = b.bild ? imgSrc(props, b.bild) : '';
      var media = src
        ? h('img', { className: 'ph', src: src, alt: b.name })
        : h('div', { className: 'ph' }, bikeIcon(), h('span', null, 'Foto folgt'));

      var kids = [
        media,
        h('span', { className: 'no' }, (i + 1 < 10 ? '0' : '') + (i + 1)),
        h('h3', null, b.name)
      ];
      if (b.tag) kids.push(h('span', { className: b.hervorheben ? 'tag hot' : 'tag' }, b.tag));
      if (b.beschreibung) kids.push(h('p', null, b.beschreibung));
      if (b.preis) {
        kids.push(h('p', { style: { marginTop: '8px' } }, h('strong', { style: { color: 'var(--ink)' } }, b.preis)));
      }
      if (b.link_url) {
        kids.push(
          h('a', { className: 'more', href: '#', onClick: noClick }, (b.link_text || 'Mehr erfahren') + '  →')
        );
      }
      return h.apply(null, ['div', { className: 'card', key: 'rad-' + i }].concat(kids));
    };

    var RaederPreview = function (props) {
      var raw = props.entry.getIn(['data', 'raeder']);
      var list = raw && raw.toJS ? raw.toJS() : [];
      var named = list.filter(function (b) {
        return b && b.name;
      });
      var visible = named.filter(function (b) {
        return b.sichtbar !== false;
      });
      var hidden = named.length - visible.length;

      var cards = visible.map(function (b, i) {
        return buildCard(props, b, i);
      });

      var notes = [];
      if (!named.length) {
        notes.push(h('p', { key: 'leer', className: 'small', style: { padding: '0 5vw 16px' } }, 'Noch keine Räder angelegt.'));
      }
      if (hidden > 0) {
        notes.push(
          h(
            'p',
            { key: 'hidden', className: 'small', style: { padding: '0 5vw 16px' } },
            hidden + (hidden === 1 ? ' Rad ist' : ' Räder sind') + ' auf der Webseite ausgeblendet.'
          )
        );
      }

      return h(
        'div',
        null,
        h('section', { className: 'show', style: { padding: '24px 5vw', marginTop: 0 } }, h('div', { className: 'grid' }, cards)),
        notes
      );
    };

    CMS.registerPreviewTemplate('raeder', RaederPreview);
  } catch (err) {
    if (window.console) console.warn('Vorschau nicht verfügbar:', err);
  }
})();
