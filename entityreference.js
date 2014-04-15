/**
 * Theme's an entity reference field.
 */
function theme_entityreference(variables) {
  try {
    dpm(variables);
    
    var html = '';
    
    // We'll make the actual field hidden, and the widget will populate the
    // hidden input later.
    html += '<input type="hidden" ' + drupalgap_attributes(variables.attributes) + '/>';
    
    // We'll also add an empty div container where the widget will get rendered.
    html += '<div id="' + variables.attributes.id + '_container"></div>';
    
    // Determine the handler for the "Mode" that is set in the "Entity
    // Selection" settings on this field.
    var handler = variables.field_info_field.settings.handler;
    switch (handler) {
      
      // Views Entity Reference Display
      case 'views':
        
        // Since our View will need a corresponding Views JSON Display, which
        // will return the same data as the Entity Reference Display that powers
        // this field, we need to assume to path to retrieve the JSON data.
        // We will use the machine name of the View, and use the View's Entity
        // Reference Display, and prefix them with 'drupalgap/'. For example,
        // If we had a view with a machine name of 'my_articles' and the machine
        // name of the corresponding entity reference display on the view was
        // 'entityreference_1', then the path we would retrieve the JSON data
        // from in Drupal would be ?q=drupalgap/my_articles/entityreference_1
        var path = 'drupalgap/' +
          variables.field_info_field.settings.handler_settings.view.view_name + '/' +
          variables.field_info_field.settings.handler_settings.view.display_name;
          
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
                widget: variables.field_info_instance.widget
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
    dpm(options);
    views_datasource_get_view_result(options.path, {
        success: function(results) {
          if (results.view.count == 0) { return; }
          dpm(results);
          var html = '';
          // Now that we've got the results, let's render the widget.
          if (options.widget.module == 'options') {
            // Check boxes/radio buttons.
            if (options.widget.type == 'options_buttons') {
              $.each(results[results.view.root], function(index, object) {
                  var entity = object[results.view.child];
                  var checkbox = {
                    title: entity.title,
                    attributes: {
                      id: entity.nid
                    }
                  };
                  var label = {element:checkbox};
                  label.element.id = checkbox.attributes.id;
                  html += theme('checkbox', checkbox) + theme('form_element_label', label);
              });
            }
            else {
              console.log('WARNING: _theme_entityreference_pageshow - unsupported widget type (' + options.widget.type + ')');
            }
          }
          else {
            console.log('WARNING: _theme_entityreference_pageshow - unsupported widget module (' + options.widget.module + ')');
          }
          $('#' + options.id + '_container').html(html).trigger('create');
        }
    });
  }
  catch (error) { console.log('_theme_entityreference_pageshow - ' + error); }
}

