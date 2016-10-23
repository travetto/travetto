encore: Email
===

This module provides email support using `nodemailer`.  This also supports templating using 
mustache, juice, and markdown.  The module is configurable using the `email` namespace. 
If you specify the transport as `null` it will use a mock mail transport to swallow all
outbound mail.  If you specify the transport as `sendmail` it will use a local sendmail
utility to send outbound messages. 

When using mustache, make sure to use `{{{ }}}`, triple braces, to prevent mustache from 
escaping any characters.