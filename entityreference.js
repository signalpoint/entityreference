/**
 * Implements hook_field_widget_form().
 */
function entityreference_field_widget_form(form, form_state, field, instance, langcode, items, delta, element) {
  try {
    switch (instance.widget.type) {
      case 'entityreference_autocomplete':
      case 'og_complex': // Adds support for the Organic Groups module.
        items[delta].type = 'autocomplete';
        items[delta].remote = true;
        items[delta].path = entityreference_views_json_path(field);
        items[delta].value = 'nid';
        items[delta].label = 'title';
        items[delta].filter = 'title';
        break;
      default:
        console.log('entityreference_field_widget_form - unknown widget type (' + instance.widget.type + ')');
        return;
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
    
    // We'll also add an empty div container where the widget will get rendered.
    html += '<div id="' + variables.attributes.id + '_container"></div>';
    
    // Determine the handler for the "Mode" that is set in the "Entity
    // Selection" settings on this field.
    var handler = variables.field_info_field.settings.handler;
    switch (handler) {
      
      // Views Entity Reference Display
      case 'views':
      case 'og': // Adds support for Organic Groups module.
        
        // Since our View will need a corresponding Views JSON Display, which
        // will return the same data as the Entity Reference Display that powers
        // this field, we need to assume the path to retrieve the JSON data.
        // We will use the machine name of the View, and use the View's Entity
        // Reference Display, and prefix them with 'drupalgap/'. For example,
        // If we had a view with a machine name of 'my_articles' and the machine
        // name of the corresponding entity reference display on the view was
        // 'entityreference_1', then the path we would retrieve the JSON data
        // from in Drupal would be ?q=drupalgap/my_articles/entityreference_1
        var path = entityreference_views_json_path(variables.field_info_field);
          
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
                field_name: field_name
            })
        });
        break;
      
      default:
        console.log('WARNING: theme_entityreference - unsupported handler (' + handler + ')');
        console.log('On your Drupal site, edit ' + field_name + ' and change the ' +
          '"Entity Selection Mode" to Views, then follow the README for the ' +
          'DrupalGap Entity Reference module to set up a View for this field.');
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

        // Depending on what module wants to handle this, build the widget
        // accordingly.
        switch (options.widget.module) {
          
          // OPTIONS MODULE
          case 'options':
            
            views_datasource_get_view_result(options.path, {
                success: function(results) {
                  if (results.view.count == 0) { return; }
                  //dpm(results);
                  var html = '';
                  // Now that we've got the results, let's render the widget.
                  // Check boxes/radio buttons.
                  if (options.widget.type == 'options_buttons') {
                    $.each(results[results.view.root], function(index, object) {
                        var referenced_entity = object[results.view.child];
                        var checkbox_id = options.id + '_' + referenced_entity.nid;
                        // Build the checkbox.
                        var checkbox = {
                          title: referenced_entity.title,
                          attributes: {
                            id: checkbox_id,
                            'class': options.field_name + ' entityreference',
                            value: referenced_entity.nid,
                            onclick: '_entityreference_onclick(this, \'' + options.id + '\', \'' + options.field_name + '\')'
                          }
                        };
                        // Check it?
                        if ($.inArray(referenced_entity.nid, target_ids) != -1) {
                          checkbox.attributes.checked = "";
                        }
                        // Build the label.
                        var label = { element:checkbox };
                        label.element.id = checkbox.attributes.id;
                        // Finally, theme the checkbox.
                        html += theme('checkbox', checkbox) + theme('form_element_label', label);
                    });
                  }
                  else {
                    console.log('WARNING: _theme_entityreference_pageshow - unsupported options widget type (' + options.widget.type + ')');
                  }
                  $('#' + options.id + '_container').html(html).trigger('create');
                }
            });
            
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
      catch (error) {
        console.log('_theme_entityreference_pageshow_success - ' + error);
      }
    }
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
    var element = {};
    $.each(items, function(delta, item) {
        element[delta] = {
          theme: 'button_link',
          text: item[entity_primary_key_title(item['entity_type'])],
          path: item['entity_type'] + '/' + item['target_id']
        };
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
    // For the "check boxes / radio buttons" widget, we must pass something like
    // this: field_name: { und: [123, 456] }
    // @see http://drupal.stackexchange.com/q/42658/10645
    var result = [];
    field_key.use_delta = false;
    field_key.use_wrapper = false;
    var ids = form_state_value.split(',');
    $.each(ids, function(delta, id) { if (!empty(id)) { result.push(id); } });
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
function entityreference_views_json_path(field_info_field) {
  try {
    return 'drupalgap/' +
      field_info_field.settings.handler_settings.view.view_name + '/' +
      field_info_field.settings.handler_settings.view.display_name;
  }
  catch (error) { console.log('entityreference_views_json_path - ' + error); }
}

