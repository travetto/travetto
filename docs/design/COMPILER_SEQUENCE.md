title Compilation Flow
participant Files
participant Events
participant Node
participant Presence
participant Compiler
participant Source
participant Module


Compiler->Transformer: Create with Root
Compiler->Module: Create with Root
Compiler->Source: Create with Root
Compiler->Presence: Create with App Roots

opt Initialize
Compiler->Node: Register require handler

Compiler->Source: Register Source Maps
Source->Node: Install source map support
Compiler->Transformer: Init
Transformer->Files: Collect all transformers, and import

Compiler->Module: Initialize Module Manager
Module->Node: Register module loader with node.js

Compiler->Presence: Init
Presence->Files: Track all files in app roots, \n and watch files not in node_modules
end

loop Module Load
    Module->Node: Load module
    alt On Error and not watching or is extension
        Module->Node: Throw error
    end
    alt If watching
        Module->Proxy: Convert module to a proxy for live reload
    end
end

loop Require
    Compiler->Source: Check if a new file
    alt If New
        Compiler->Presence: Track file
    end
    Compiler->Source: Get file contents
    Compiler->Module: Compile file
    Module->Node: Compile
    alt If Error in compile
        Module->Module: Chain errors to detect cyclical dependencies
    end
    
    alt If New
        Compiler->Events: Trigger Post Required of new file
    end
    Compiler->Node: Return module
    
    alt On Error
        alt If not extension and in watch mode
            Compiler->Node: Return stub module for lazy loading
        end
        alt otherwise
            Compiler->Node: Throw Error
        end
    end
end

loop Presence Change
    alt if file added
        Compiler->Compiler: Transpile
        Compiler->Events: Emit file added event
    end
    alt if file changed
        Compiler->Compiler: Transpile
        Compiler->Events: Emit file changed event
    end
    alt if file removed
        Compiler->Compiler: Unload
        Compiler->Events: Emit file removed event
    end
end

loop Transpile
    Compiler->Transformer: Collect transformers for transpiling
    Compiler->Source: Transpile File
    alt On Error and watching
        Compiler->Source: Stub out file contents for lazy laod
    end
    alt File changed and is a watched file
        Compiler->Compiler: Mark for reloading
    end
end

loop Unload
    Compiler->Source: Unload
    Source->Files: Remove file from cache
    Compiler->Node: Delete from require cache
    Compiler->Module: Unload
    alt If watching
        Module->Module: Clear proxy target
    end
end