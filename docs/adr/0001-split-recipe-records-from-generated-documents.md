# Split recipe records from generated documents

The app stores each recipe as a canonical Recipe Record in `Cookbook/.data` and generates a separate Recipe Document in `Cookbook/Recipes`. Recipe Records own Recipe Identity and are the only source used for listing and editing; Recipe Documents are automatically overwritten generated output, updated in place through the Google Docs API so document formatting is controlled by code rather than Google Drive HTML conversion or manual edits.
