# _plugins/code_runner.rb
require 'cgi'
require 'base64'

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
      fname = @filename.to_s.empty? ? "main.#{@language}" : @filename.include?('.') ? @filename : "#{@filename}.#{@language}"
      encoded_code = Base64.strict_encode64(code)
      iframe = <<~IFRAME
        <iframe class="code-runner-iframe"
          src="/embed/code_runner.html?id=#{@id}&lang=#{@language}&code=#{encoded_code}&filename=#{CGI.escape(fname)}"
          width="100%" height="100%" style="width:100%;height:100%;border:0;padding:0;display:block;"
          frameborder="0"
          allow="clipboard-write"
        ></iframe>
      IFRAME

      <<~HTML
        <div class="code-runner-wrapper" id="runner-#{@id}">
          <div class="code-runner-header">
            <span class="code-runner-filename">#{fname}</span>
            <button class="code-runner-run" data-runner-id="#{@id}">Run ▶</button>
          </div>
          <div id="editor-#{@id}" class="code-runner-editor">
            #{iframe}
          </div>
          <pre id="console-#{@id}" class="code-runner-console">Click Run ▶</pre>
        </div>
      HTML
    end
  end
end

Liquid::Template.register_tag('code_runner', Jekyll::CodeRunnerBlock)
