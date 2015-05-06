entityreference
===============

Adds Entity Reference support for DrupalGap.

1. Enable the "DrupalGap Entity Reference" module on your Drupal site.
   This is a sub module included with the DrupalGap module.
2. Enable this module in your settings.js file:
     Drupal.modules.contrib['entityreference'] = {};
3. See http://drupalgap.org/node/240 for usage.

4. (Optional, but recommended) On your Drupal site, patch the Services module
  with this patch:
  
  https://www.drupal.org/node/2403645#comment-9897585

This will allow the "Simple" entity select mode to work on an entity reference
field widget to work in the app for your content type's add/edit form.

Here are some terminal commands that can be used to apply the patch:

```
# cd www/sites/all/modules
# rm -rf services
# drush dl services --dev
# cd services
# wget https://www.drupal.org/files/issues/index_conditions-2403645-16.patch
# patch -p1 < index_conditions-2403645-12.patch
# drush cc all
```

4a. Without the patch mentioned in #4, the only way to get entity reference
field widget to work, is to closely follow instructions mentioned in step 3.

