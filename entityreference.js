/**
 * Given settings from an entity reference field's field_info_field object, this will
 * return an array of bundle names that are used for the target when using Simple entity
 * selection mode. It will return null if there are no target bundles.
 * @param field_settings
 * @returns {*}
 */
function entityreference_get_target_bundles(field_settings) {
  try {
    var bundles = [];
    for (var bundle in field_settings.handler_settings.target_bundles) {
      if (!field_settings.handler_settings.target_bundles.hasOwnProperty(bundle)) { continue; }
      var name = field_settings.handler_settings.target_bundles[bundle];
      var bundle_info = entityreference_get_bundle_and_name_from_field_settings(bundle, field_settings);
      if (bundle_info.bundle) { bundles.push(bundle_info.bundle); }
    }
    return bundles.length ? bundles : null;
  }
  catch (error) { console.log('entityreference_get_target_bundles - ' + error); }
}

function entityreference_get_bundle_and_name_from_field_settings(target_bundle, field_settings) {
  var result = {
    bundle_name: null,
    bundle: null
  };
  switch (field_settings.target_type) {
    case 'node':
      result.bundle_name = 'type';
        if (target_bundle == 'group') { result.bundle = target_bundle; }
      break;
    case 'taxonomy_term':
      result.bundle_name = 'vid';
      result.bundle = taxonomy_vocabulary_get_vid_from_name(target_bundle);
      break;
  }
  return result;
}

/**
 * Implements hook_field_widget_form().
 */
function entityreference_field_widget_form(form, form_state, field, instance, langcode, items, delta, element) {
  try {

    // Build the widget based on the type (we only support auto complete for
    // now).
    switch (instance.widget.type) {
      case 'entityreference_autocomplete':
      case 'entityreference_autocomplete_tags':
      case 'og_complex': // Adds support for the Organic Groups module.

        // Set up the autocomplete.
        var key_title = entity_primary_key_title(field.settings.target_type);
        items[delta].type = 'autocomplete';
        items[delta].delta = delta;
        items[delta].remote = true;
        items[delta].value = entity_primary_key(field.settings.target_type);
        items[delta].label = key_title;
        items[delta].filter = key_title;
        items[delta].path = entityreference_autocomplete_path(field, items[delta]);

        // Set any existing item values.
        if (items[delta].item && items[delta].item.target_id) {
          items[delta].default_value = items[delta].item.target_id;
          items[delta].default_value_label = items[delta].item[key_title];
        }

        break;
      default:
        console.log('entityreference_field_widget_form - unknown widget type (' + instance.widget.type + ')');
        break;
    }

  }
  catch (error) { console.log('entityreference_field_widget_form - ' + error); }
}

/**
 * Theme's an entity reference field.
 */
function theme_entityreference(variables) {
  try {

    // @TODO - this function name is misleading because its primarily used to
    // provide the widget during node creation/editing, and not associated with
    // the public display of the field, which is typically the case when using
    // a theme('example', ...) call. The function name should be more of an
    // extension of the field widget form function's name above.
    
    var html = '';
    
    var field_name = variables.field_info_field.field_name;
    
    // We'll make the actual field hidden, and the widget will populate the
    // hidden input later.
    //html += '<input type="hidden" ' + drupalgap_attributes(variables.attributes) + '/>';

    // Figure out the entity type index involved.
    var entity_type = null;
    var entity_type_index = null;
    if (typeof variables.field_info_instance.settings.behaviors !== 'undefined') {
      for (entity_type_index in variables.field_info_instance.settings.behaviors) {
        if (!variables.field_info_instance.settings.behaviors.hasOwnProperty(entity_type_index)) { continue; }
        var behavior = variables.field_info_instance.settings.behaviors[entity_type_index];
        if (behavior.status) {
          entity_type_index = entity_type_index.replace(/-/g, '_');
          entity_type_index = entity_type_index.replace('taxonomy', 'taxonomy_term');
          entity_type = entity_type_index.replace('_index', '');
          break;
        }
      }
    }
    
    // We'll also add an empty div container where the widget will get rendered.
    html += '<div id="' + variables.attributes.id + '_container"></div>';
    
    // Determine the handler for the "Mode" that is set in the "Entity
    // Selection" settings on this field.
    var handler = variables.field_info_field.settings.handler;
    switch (handler) {
      
      // Views Entity Reference Display
      case 'views':
      case 'og': // Adds support for Organic Groups module.
      case 'base':
        
        // Since our View will need a corresponding Views JSON Display, which
        // will return the same data as the Entity Reference Display that powers
        // this field, we need to assume the path to retrieve the JSON data.
        // We will use the machine name of the View, and use the View's Entity
        // Reference Display, and prefix them with 'drupalgap/'. For example,
        // If we had a view with a machine name of 'my_articles' and the machine
        // name of the corresponding entity reference display on the view was
        // 'entityreference_1', then the path we would retrieve the JSON data
        // from in Drupal would be ?q=drupalgap/my_articles/entityreference_1
        var path = entityreference_autocomplete_path(variables.field_info_field);
          
        // Now that we've got the path to the Views JSON page display, we need
        // to fetch that data and inject it into the widget on the pageshow
        // event.
        html += drupalgap_jqm_page_event_script_code({
            page_id: drupalgap_get_page_id(),
            jqm_page_event: 'pageshow',
            jqm_page_event_callback: '_theme_entityreference_pageshow',
            jqm_page_event_args: JSON.stringify({
              id: variables.attributes.id,
              path: path,
              widget: variables.field_info_instance.widget,
              field_name: field_name,
              entity_type: entity_type,
              entity_type_index: entity_type_index,
              bundles: entityreference_get_target_bundles(variables.field_info_field.settings),
              cardinality: variables.field_info_field.cardinality
            })
        });
        break;
      
      default:
        console.log('WARNING: theme_entityreference - unsupported handler (' + handler + ')');
        break;
    }
    
    return html;
    
  }
  catch (error) { console.log('theme_entityreference - ' + error); }
}

/**
 *
 */
function _theme_entityreference_pageshow(options) {
  try {
    // We need a callback function to process this particular instance, so let's
    // declare it first.
    var _theme_entityreference_pageshow_success = function(entity) {
      try {

        // If we have an entity, it means we are editing it, so build an array
        // of target ids, so we can easily reference them later.
        var target_ids = [];
        if (entity) {
          // Handle multi lingual entities by determining the language code for
          // the field.
          var language = 'und';
          if (typeof entity.language !== 'undefined' && entity.language != 'und') {
            language = entity.language;
            if (typeof entity[options.field_name][language] === 'undefined') { language = 'und'; }
          }
          // Skip the extraction of target ids from empty entity reference
          // fields. Otherwise pull out the target ids.
          if ($.isArray(entity[options.field_name]) && entity[options.field_name].length == 0) { }
          else {
            $.each(entity[options.field_name][language], function(delta, reference) {
                target_ids.push(reference.target_id);
            });
            // Place the target ids onto the hidden input's value.
            if (target_ids.length > 0) {
              $('#' + options.id).val(target_ids.join(','));
            }
          }
        }

        // Build the query to the entity index resource.
        var primary_key = entity_primary_key(options.entity_type);
        var label = entity_primary_key_title(options.entity_type);
        var bundles = options.bundles;
        var index_options = { orderby: {}};
        index_options.orderby[label] = 'asc';
        var query = {
          parameters: {},
          fields: [primary_key, label],
          options: index_options
        };
        if (bundles) { query.parameters[entity_get_bundle_name(options.entity_type)] = bundles.join(','); }

        // Call the index resource for the entity type.
        window[options.entity_type_index](query, { success: function(entities) {

          if (!entities || entities.length == 0) { return; }

          // Depending on what module wants to handle this, build the widget accordingly.
          // @TODO add support for parent/child term indentation on select lists, radios, checkboxes.
          var html = '';
          var select_options = null;
          var css_classes = options.field_name + ' entityreference';
          for (var i = 0; i < entities.length; i++) {
            var referenced_entity = entities[i];

            switch (options.widget.module) {

              // OPTIONS MODULE
              case 'options':

                switch (options.widget.type) {

                  // Select list.
                  case 'options_select':

                    // Set aside the options until later.
                    if (!select_options) { select_options = {}; }
                    select_options[referenced_entity[primary_key]] = referenced_entity[label];

                    break;

                  // Checkboxes and radios.
                  case 'options_buttons':

                      // Radios.
                      if (options.cardinality == 1) {

                        // Set aside the options until later.
                        if (!select_options) { select_options = {}; }
                        select_options[referenced_entity[primary_key]] = referenced_entity[label];

                      }

                      // Checkboxes
                      else {

                        // Build the checkbox.
                        var checkbox_id = options.id + '_' + referenced_entity[primary_key];
                        var checkbox = {
                          title: referenced_entity[label],
                          attributes: {
                            id: checkbox_id,
                            'class': css_classes,
                            value: referenced_entity[primary_key],
                            onclick: '_entityreference_onclick(this, \'' + options.id + '\', \'' + options.field_name + '\')'
                          }
                        };

                        // Check it?
                        if ($.inArray(referenced_entity[primary_key], target_ids) != -1) {
                          checkbox.attributes.checked = "";
                        }

                        // Build the label.
                        var input_label = { element:checkbox };
                        input_label.element.id = checkbox.attributes.id;

                        // Finally, theme the checkbox.
                        html += theme('checkbox', checkbox) + theme('form_element_label', input_label);

                      }

                    break;

                  default:
                    console.log('WARNING: _theme_entityreference_pageshow - unsupported options widget type (' + options.widget.type + ')');
                    break;
                }

                break;

              // ENTITYREFERENCE MODULE
              case 'entityreference':
              case 'og': // Adds support for the Organic Groups module.
                break;

              default:
                console.log('WARNING: _theme_entityreference_pageshow - unsupported widget module (' + options.widget.module + ')');
                break;
            }
          }

          // Do any post processing...

          // Handle select list options.
          if (options.widget.type == 'options_select' && select_options) {
            html += theme('select', {
              attributes: {
                id: options.id,
                'class': css_classes
              },
              options: select_options,
              value: target_ids.join(',')
            });
          }

          // Radio buttons and check boxes.
          else if (options.widget.type == 'options_buttons') {

            // Radios.
            if (options.cardinality == 1 && select_options) {
              html += theme('radios', {
                attributes: {
                  id: options.id,
                  'class': css_classes,
                  onclick: '_entityreference_onclick(this, \'' + options.id + '\', \'' + options.field_name + '\')'
                },
                options: select_options,
                value: target_ids.join(',')
              });
            }

            // Checkboxes.
            else{

            }

            // Theme the hidden input to hold the value.
            html = theme('hidden', {
              attributes: {
                id: options.id,
                value: target_ids.join(',')
              }
            }) + html;

          }

          // Finally inject the html into the waiting container.
          $('#' + options.id + '_container').html(html).trigger('create');

        }});
        
      }
      catch (error) {
        console.log('_theme_entityreference_pageshow_success - ' + error);
      }
    };
    // If we're editing an entity, we need to load the entity object, then pass
    // it along to our success handler declared earlier. If we're not editing,
    // just go directly to the success handler with a null entity.
    if (typeof parseInt(arg(1)) === 'number' && arg(2) == 'edit') {
      entity_load(arg(0), arg(1), {
          success: _theme_entityreference_pageshow_success
      });
    }
    else { _theme_entityreference_pageshow_success(null); }
  }
  catch (error) { console.log('_theme_entityreference_pageshow - ' + error); }
}

/**
 * Implements hook_field_formatter_view().
 */
function entityreference_field_formatter_view(entity_type, entity, field, instance, langcode, items, display) {
  try {

    //console.log(entity_type);
    //console.log(entity);
    //console.log(field);
    //console.log(instance);
    //console.log(display);

    var element = {};
    $.each(items, function(delta, item) {

        //dpm(delta);
        //console.log(item);

        switch (display.type) {

          // Label
          case 'entityreference_label':
            var text = item[entity_primary_key_title(item['entity_type'])];
            if (display.settings.link == 1) { // Display as link.
              var prefix = item['entity_type'];
              if (in_array(prefix, ['taxonomy_term', 'taxonomy_vocabulary'])) {
                prefix = prefix.replace('_', '/');
              }
              element[delta] = {
                theme: 'button_link',
                text: text,
                path: prefix + '/' + item['target_id']
              };
            }
            else { // Display as plain text.
              element[delta] = { markup: '<div>' + text + '</div>' };
            }
            break;

          // Entity id
          case 'entityreference_entity_id':
            element[delta] = { markup: '<div>' + item.target_id + '</div>' };
            break;

          // Rendered entity
          case 'entityreference_entity_view':
            drupalgap_entity_render_content(item.entity_type, item.entity);
            element[delta] = { markup: item.entity.content };
            break;

          default:
            console.log('entityreference_field_formatter_view - unsupported type: ' + display.type);
            break;

        }

    });
    return element;
  }
  catch (error) { console.log('entityreference_field_formatter_view - ' + error); }
}

/**
 * Implements hook_assemble_form_state_into_field().
 */
function entityreference_assemble_form_state_into_field(entity_type, bundle,
  form_state_value, field, instance, langcode, delta, field_key) {
  try {
    if (typeof form_state_value === 'undefined') { return null; }
    var result = null;
    switch (instance.widget.type) {
      case 'entityreference_autocomplete':
      case 'og_complex': // Adds support for the Organic Groups module.
        field_key.value = 'target_id';
        if (form_state_value == '') { result = ''; } // This allows values to be deleted.
        // @see http://drupal.stackexchange.com/a/40347/10645
        else if (!empty(form_state_value)) { result = '... (' + form_state_value + ')'; }
        break;
      default:
        // For the "check boxes / radio buttons" widget, we must pass something
        // like this: field_name: { und: [123, 456] }
        // @see http://drupal.stackexchange.com/q/42658/10645
        result = [];
        field_key.use_delta = false;
        field_key.use_wrapper = false;
        var ids = form_state_value.split(',');
        $.each(ids, function(delta, id) { if (!empty(id)) { result.push(id); } });
        break;
    }
    return result;
  }
  catch (error) { console.log('entityreference_assemble_form_state_into_field - ' + error); }
}

/**
 *
 */
function _entityreference_onclick(input, input_id, field_name) {
  try {
    // For each checkbox that is checked for the entity reference field,
    // build a comma separated string of the referenced entity ids, then place
    // the string in the form element's hidden input value.
    var ids = [];
    var selector = '#' + drupalgap_get_page_id() + ' input.' + field_name + '.entityreference';
    $(selector).each(function(index, object) {
        if ($(object).is(':checked')) {
          ids.push($(object).val());
        }
    });
    var value = '';
    if (ids.length != 0) { value = ids.join(','); }
    $('#' + input_id).val(value);
  }
  catch (error) { console.log('_entityreference_onclick - ' + error); }
}

/**
 *
 */
function entityreference_autocomplete_path(field) {
  try {
    switch (field.settings.handler) {
      case 'views':
        // We're using a view, so return the path to the Page display for the
        // field.
        return 'drupalgap/' +
          field.settings.handler_settings.view.view_name + '/' +
          field.settings.handler_settings.view.display_name;
        break;
      case 'base':
      case 'og':
        // If we were passed a form element item, set the autocomplete to custom
        // so it uses the Index resource instead of Views JSON.
        if (arguments[1]) { arguments[1].custom = true; }
        // Since we're using the base handler, we'll use the Index resource for
        // the entity type.
        return 'drupalgap/' + field.settings.target_type + '.json';
        break;
    }
  }
  catch (error) { console.log('entityreference_autocomplete_path - ' + error); }
}

/**
 * Implements hook_views_exposed_filter().
 * @param {Object} form
 * @param {Object} form_state
 * @param {Object} element
 * @param {Object} filter
 * @param {Object} field
 */
function entityreference_views_exposed_filter(form, form_state, element, filter, field) {
  try {

    //console.log('element');
    //console.log(element);
    //console.log('filter');
    //console.log(filter);
    //console.log('field');
    //console.log(field);

    // Make a select list with the available value options.
    element.type = 'select';
    element.options = {};
    for (var index in filter.value_options) {
      if (!filter.value_options.hasOwnProperty(index)) { continue; }
      element.options[index] =  filter.value_options[index];
    }
    
    if (!element.required) {
      element.options['All'] = '- ' + t('Any') + ' -';
      if (typeof element.value === 'undefined') { element.value = 'All'; }
    }
    
    if (!empty(filter.value)) { element.value = filter.value[0]; }

    return element;

  }
  catch (error) { console.log('entityreference_views_exposed_filter - ' + error); }
}
