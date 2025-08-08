# _plugins/code_runner.rb
require 'cgi'

module Jekyll
  class CodeRunnerBlock < Liquid::Block
    SYNTAX = /(id="([^"]+)"\s+language="([^"]+)"(?:\s+filename="([^"]+)")?)/

    def initialize(tag_name, markup, tokens)
      super
      unless markup =~ SYNTAX
        raise SyntaxError,
          "Valid syntax: {% code_runner id=\"foo\" language=\"cpp\" [filename=\"bar\"] %}"
      end
      @id, @language, @filename = $2, $3, $4
    end

    def render(context)
      code = super.strip
      fname = @filename.to_s.empty? ?
                 "main.#{@language}" :
                 @filename.include?('.') ? @filename : "#{@filename}.#{@language}"
      json_code = CGI.escapeHTML(code.to_json)

      <<~HTML
      <div class="code-runner-wrapper" id="runner-#{@id}">
        <div class="code-runner-header">
          <span class="code-runner-filename">#{fname}</span>
          <button class="code-runner-run" data-runner-id="#{@id}">Run ▶</button>
        </div>
        <div id="editor-#{@id}" class="code-runner-editor"
             data-code='#{json_code}'
             data-lang='#{@language}'></div>
        <pre id="console-#{@id}" class="code-runner-console">Click Run ▶</pre>
      </div>
      HTML
    end
  end
end

Liquid::Template.register_tag('code_runner', Jekyll::CodeRunnerBlock)
